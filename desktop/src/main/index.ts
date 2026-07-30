import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import * as crypto from "crypto";
import { ApiClient, ApiError } from "./api-client";
import {
  saveCredentials,
  loadCredentials,
  clearCredentials,
  saveSettings,
  loadSettings,
  getOrCreateInstallationId,
} from "./credential-store";
import { FolderWatcher } from "./folder-watcher";
import { UploadQueue } from "./upload-queue";
import { HeartbeatSender } from "./heartbeat";
import { MqttClient } from "./mqtt-client";
import { RoastStudioSession } from "./roast-studio-session";
import { getDefaultProfileDirectory, writeAlogProfile } from "./alog-writer";
import { SystemTray } from "./tray";
import { detectArtisanFolder, validateFolder } from "./folder-detector";
import { detectMachineDevices } from "./machine-detector";
import { DeviceBridge } from "./device-bridge";
import { StudioCheckpointStore } from "./studio-checkpoint";
import { logger } from "./logger";
import type {
  AppStatus,
  ConnectorCredentials,
  AppSettings,
  RoastStudioEventType,
  StartSimulatorRequest,
  DeviceLoginState,
  RoastStudioState,
  DeviceBridgeConfig,
} from "../shared/types";
import { getErrorMessage } from "../shared/errors";
import { sanitizeDeviceBridgeConfig } from "../shared/device-config";
import { shouldHideWindowOnClose } from "./window-lifecycle";
import { createDiagnosticReport } from "./diagnostics";

const APP_VERSION = app.getVersion();
// The Studio UI is 2D/SVG only. Disabling GPU acceleration avoids blank
// Electron windows on roasting-floor PCs with older or remote-display drivers.
app.disableHardwareAcceleration();

let mainWindow: BrowserWindow | null = null;
let tray: SystemTray | null = null;
let apiClient: ApiClient | null = null;
let credentials: ConnectorCredentials | null = null;
let settings: AppSettings;
let watcher: FolderWatcher | null = null;
let queue: UploadQueue | null = null;
let heartbeat: HeartbeatSender | null = null;
let mqttClient: MqttClient | null = null;
let currentStatus: AppStatus = "pairing";
const studioSession = new RoastStudioSession();
const deviceBridge = new DeviceBridge();
const savedStudioSessions = new Set<string>();
let deviceLoginState: DeviceLoginState = { status: "idle" };
let deviceLoginTimer: NodeJS.Timeout | null = null;
let checkpointStore: StudioCheckpointStore | null = null;
let lastCheckpointAt = 0;
let isQuitting = false;
let deviceReconnectTimer: NodeJS.Timeout | null = null;
let deviceReconnectAttempt = 0;

// ─── App Lifecycle ───────────────────────────────────────────────────────────

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    console.log("[DEBUG] App ready, initializing...");

    // Initialize
    settings = loadSettings();
    credentials = loadCredentials();
    checkpointStore = new StudioCheckpointStore(path.join(app.getPath("userData"), "data"));
    const recoveredSession = checkpointStore.load();
    if (recoveredSession) {
      studioSession.restore(recoveredSession);
      logger.warn("Recovered unfinished roast session", {
        sessionId: recoveredSession.sessionId,
        elapsedSeconds: recoveredSession.elapsedSeconds,
      });
    }
    queue = new UploadQueue();
    await queue.init();

    // Auto-detect Artisan folder if not configured
    if (!settings.watchFolder) {
      const detected = detectArtisanFolder();
      if (detected) {
        settings.watchFolder = detected;
        saveSettings(settings);
        logger.info("Auto-detected Artisan folder", { path: detected });
      }
    }

    console.log("[DEBUG] Queue initialized, creating window...");

    // Create main window
    createWindow();
    studioSession.onChange((state) => {
      mainWindow?.webContents.send("studio-state-change", state);
      if (state.status === "RECORDING" && state.source === "DIRECT") {
        const now = Date.now();
        if (now - lastCheckpointAt >= 3000 || state.points.length <= 1) {
          checkpointStore?.save(state);
          lastCheckpointAt = now;
        }
      } else if (state.status === "IDLE") {
        checkpointStore?.clear();
        lastCheckpointAt = 0;
      }
      persistFinishedStudioSession(state);
    });
    deviceBridge.onState((state) => {
      mainWindow?.webContents.send("device-bridge-state-change", state);
      if (state.status === "CONNECTED" || state.status === "STREAMING") {
        deviceReconnectAttempt = 0;
        if (deviceReconnectTimer) clearTimeout(deviceReconnectTimer);
        deviceReconnectTimer = null;
      } else if (state.status === "ERROR") {
        scheduleDeviceReconnect();
      }
    });
    deviceBridge.onSample((sample) => {
      mainWindow?.webContents.send("device-bridge-sample", sample);
      studioSession.ingestDirect(sample);
    });

    console.log("[DEBUG] Window created, setting up tray...");

    // Create tray
    tray = new SystemTray(mainWindow!);
    tray.create();

    console.log("[DEBUG] Tray created, initializing API client...");

    // Initialize API client
    apiClient = new ApiClient(settings.apiBaseUrl);

    // Resume any pending uploads from previous session
    queue!.resumePending();
    processQueue();

    console.log("[DEBUG] App fully initialized");

    // If credentials exist, verify them with a heartbeat before connecting
    if (credentials) {
      try {
        await apiClient!.heartbeat(
          {
            appVersion: APP_VERSION,
            computerName: os.hostname(),
            queueSize: queue!.getPendingCount(),
            watchFolderConfigured: !!settings.watchFolder,
          },
          credentials.connectorToken,
        );
        logger.info("Credentials verified, connecting...");
        setConnected();
      } catch (err) {
        const code = err instanceof ApiError ? err.code : "UNKNOWN";
        // Only clear credentials on explicit revocation (401)
        // Network errors, timeouts should NOT clear credentials
        if (code === "UNAUTHORIZED") {
          logger.warn("Credential revoked by server", { code });
          clearCredentials();
          credentials = null;
          setStatus("pairing");
        } else {
          // Transient error - try connecting anyway, heartbeat will retry
          logger.warn("Heartbeat failed on startup, connecting anyway", { code });
          setConnected();
        }
      }
    } else {
      setStatus("pairing");
    }

    void restoreDeviceConnection();

    logger.info("App started", { version: APP_VERSION });
  });

  app.on("window-all-closed", () => {
    // Keep running in tray
  });

  app.on("before-quit", () => {
    isQuitting = true;
    const state = studioSession.getState();
    if (state.status === "RECORDING" && state.source === "DIRECT") checkpointStore?.save(state);
    cleanup();
  });
}

// ─── Window ──────────────────────────────────────────────────────────────────

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 980,
    minHeight: 680,
    resizable: true,
    maximizable: true,
    title: "Roastd Studio",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    show: true,
  });

  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));

  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    if (level >= 2) logger.error("Renderer console error", { level, message, line, sourceId });
  });
  mainWindow.webContents.on("preload-error", (_event, preloadPath, error) => {
    logger.error("Preload failed", { preloadPath, error: error.message });
  });
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    logger.error("Renderer failed to load", { errorCode, errorDescription });
  });
  mainWindow.webContents.on("did-finish-load", () => {
    setTimeout(async () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      try {
        const state = await mainWindow.webContents.executeJavaScript(`({
          readyState: document.readyState,
          rootLength: document.getElementById("root")?.innerHTML.length || 0,
          hasElectronApi: typeof window.electronAPI === "object"
        })`);
        if (state.rootLength > 0) {
          logger.info("Renderer ready", state);
          return;
        }
        logger.error("Renderer remained blank after load", state);
        await mainWindow.webContents.executeJavaScript(`(() => {
          const root = document.getElementById("root");
          if (!root) return;
          root.innerHTML = '<main class="message-shell"><div class="message-card"><div class="warning-dot">!</div><h1>Studio gagal dimuat</h1><p>Renderer tidak berhasil dijalankan. Buka log untuk detail lalu coba muat ulang.</p><button id="reload-studio" class="primary-btn">Muat ulang</button></div></main>';
          document.getElementById("reload-studio")?.addEventListener("click", () => location.reload());
        })()`);
      } catch (error) {
        logger.error("Renderer readiness check failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, 1_500);
  });
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    logger.error("Renderer process stopped", { reason: details.reason, exitCode: details.exitCode });
  });

  mainWindow.on("close", (e) => {
    // Minimize to tray instead of quitting
    if (shouldHideWindowOnClose(isQuitting)) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
}

// ─── Status Management ───────────────────────────────────────────────────────

function setStatus(status: AppStatus): void {
  currentStatus = status;
  tray?.setStatus(status);
  mainWindow?.webContents.send("status-change", status);
}

function setConnected(): void {
  if (!credentials) return;

  setStatus("connected");

  // Start heartbeat
  heartbeat = new HeartbeatSender({
    apiClient: apiClient!,
    token: credentials.connectorToken,
    appVersion: APP_VERSION,
    getQueueSize: () => queue!.getPendingCount(),
    getWatchFolderConfigured: () => !!settings.watchFolder,
    onAuthExpired: () => {
      setStatus("auth_expired");
      clearCredentials();
      credentials = null;
    },
  });
  heartbeat.start();

  // Start watcher if folder is configured
  if (settings.watchFolder) {
    startWatcher(settings.watchFolder);
  }

  // Start MQTT client for live telemetry
  if (settings.mqttBrokerUrl) {
    mqttClient = new MqttClient({
      apiClient: apiClient!,
      token: credentials.connectorToken,
      machineId: credentials.machineId,
      tenantId: credentials.connectorId, // connectorId is used as tenant context
      brokerUrl: settings.mqttBrokerUrl,
      onData: (payload) => {
        studioSession.ingestMqtt(payload);
        mainWindow?.webContents.send("mqtt-data", payload);
      },
    });
    mqttClient.connect();
  }

  // Notify renderer
  mainWindow?.webContents.send("connected", {
    machineName: credentials.machineName,
    computerName: credentials.computerName,
    watchFolder: settings.watchFolder,
  });
}

// ─── IPC Handlers ────────────────────────────────────────────────────────────

ipcMain.handle("get-status", () => currentStatus);
ipcMain.handle("get-credentials", () => credentials);
ipcMain.handle("get-settings", () => settings);

ipcMain.handle("update-settings", (_event, data: Partial<AppSettings>) => {
  const apiBaseUrlChanged = Boolean(data.apiBaseUrl && data.apiBaseUrl !== settings.apiBaseUrl);
  Object.assign(settings, data);
  saveSettings(settings);
  if (apiBaseUrlChanged) apiClient = new ApiClient(settings.apiBaseUrl);
  return settings;
});

ipcMain.handle("pair", async (_event, data: { code: string }) => {
  try {
    if (!apiClient) throw new Error("API client not initialized");

    const installationId = getOrCreateInstallationId();
    const result = await apiClient.pair({
      pairingCode: data.code,
      installationId,
      computerName: os.hostname(),
      platform: process.platform,
      appVersion: APP_VERSION,
    });

    credentials = {
      connectorId: result.connectorId,
      connectorToken: result.connectorToken,
      machineId: result.machine.id,
      machineName: result.machine.name,
      installationId,
      computerName: os.hostname(),
    };

    saveCredentials(credentials);
    setConnected();

    logger.info("Pairing successful", {
      machineName: result.machine.name,
    });

    return { success: true };
  } catch (err) {
    const code = err instanceof ApiError ? err.code : "UNKNOWN";
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    logger.error("Pairing failed", { code, message, stack, apiBaseUrl: settings.apiBaseUrl });
    return { success: false, error: getErrorMessage(code), debugError: message };
  }
});

ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openDirectory"],
    title: "Pilih Folder Autosave Artisan",
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const folder = result.filePaths[0];
  const validation = validateFolder(folder);

  if (!validation.valid) {
    return { error: validation.error };
  }

  settings.watchFolder = folder;
  saveSettings(settings);

  startWatcher(folder);

  return { path: folder, alogCount: validation.alogCount };
});

ipcMain.handle("detect-folder", () => {
  const detected = detectArtisanFolder();
  if (detected) {
    settings.watchFolder = detected;
    saveSettings(settings);
    startWatcher(detected);
    return { path: detected, success: true };
  }
  return { path: null, success: false };
});

ipcMain.handle("disconnect", async () => {
  try {
    if (credentials && apiClient) {
      // Try to revoke connector on server
      await apiClient.heartbeat(
        { appVersion: APP_VERSION, computerName: os.hostname(), queueSize: 0, watchFolderConfigured: false },
        credentials.connectorToken,
      );
    }
  } catch {
    // Best effort — proceed with local cleanup
  }

  cleanup();
  clearCredentials();
  credentials = null;
  setDeviceLoginState({ status: "idle" });
  settings.watchFolder = null;
  saveSettings(settings);

  setStatus("pairing");
  mainWindow?.webContents.send("disconnected");

  logger.info("Disconnected");
  return { success: true };
});

ipcMain.handle("open-log-folder", () => {
  shell.openPath(logger.getLogDir());
});
ipcMain.handle("create-diagnostic-report", async () => {
  try {
    const devices = await detectMachineDevices();
    const filePath = createDiagnosticReport({
      outputDir: path.join(app.getPath("userData"), "diagnostics"),
      logDir: logger.getLogDir(),
      version: APP_VERSION,
      platform: `${process.platform}-${process.arch} ${os.release()}`,
      status: currentStatus,
      queueSize: queue?.getPendingCount() ?? 0,
      settings,
      bridgeState: deviceBridge.getState(),
      devices,
    });
    shell.showItemInFolder(filePath);
    logger.info("Diagnostic report created", { filePath });
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});
ipcMain.handle("open-profile-folder", () => {
  const profileDirectory = getDefaultProfileDirectory();
  fs.mkdirSync(profileDirectory, { recursive: true });
  return shell.openPath(profileDirectory);
});

ipcMain.handle("get-queue-size", () => queue!.getPendingCount());
ipcMain.handle("detect-machine-devices", async () => {
  const fallback = await detectMachineDevices();
  try {
    const bridgeDevices = await deviceBridge.discover();
    const merged = new Map(fallback.map((device) => [device.path, device]));
    for (const device of bridgeDevices) merged.set(device.path, { ...merged.get(device.path), ...device });
    return [...merged.values()];
  } catch (error) {
    logger.warn("Device bridge discovery unavailable; using Windows serial discovery", {
      error: error instanceof Error ? error.message : String(error),
    });
    return fallback;
  }
});
ipcMain.handle("device-bridge-get-state", () => deviceBridge.getState());
ipcMain.handle("device-bridge-connect", async (_event, config: DeviceBridgeConfig) => {
  try {
    const normalizedConfig = sanitizeDeviceBridgeConfig(config);
    if (!normalizedConfig) throw new Error("Konfigurasi perangkat tidak valid.");
    const state = await deviceBridge.connect(normalizedConfig);
    settings.deviceConfig = normalizedConfig;
    settings.selectedSerialPort = normalizedConfig.port;
    settings.serialAdapter = normalizedConfig.adapter;
    settings.serialBaudRate = normalizedConfig.baudRate;
    saveSettings(settings);
    return { success: true, state };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

async function restoreDeviceConnection(): Promise<void> {
  if (!settings.autoReconnectDevice || !settings.deviceConfig) return;
  try {
    await deviceBridge.connect(settings.deviceConfig);
    const studioState = studioSession.getState();
    if (studioState.status === "RECORDING" && studioState.source === "DIRECT") {
      await deviceBridge.start();
    }
    logger.info("Machine reader reconnected", {
      adapter: settings.deviceConfig.adapter,
      port: settings.deviceConfig.port,
    });
  } catch (error) {
    logger.warn("Machine reader auto-reconnect failed", {
      adapter: settings.deviceConfig.adapter,
      port: settings.deviceConfig.port,
      error: error instanceof Error ? error.message : String(error),
    });
    scheduleDeviceReconnect();
  }
}

function scheduleDeviceReconnect(): void {
  if (isQuitting || !settings?.autoReconnectDevice || !settings.deviceConfig || deviceReconnectTimer) return;
  const delayMs = Math.min(30_000, 2_000 * (2 ** deviceReconnectAttempt));
  deviceReconnectAttempt += 1;
  logger.warn("Machine reader reconnect scheduled", { attempt: deviceReconnectAttempt, delayMs });
  deviceReconnectTimer = setTimeout(() => {
    deviceReconnectTimer = null;
    void restoreDeviceConnection();
  }, delayMs);
}
ipcMain.handle("device-bridge-test", async () => {
  try {
    return { success: true, sample: await deviceBridge.test(), state: deviceBridge.getState() };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});
ipcMain.handle("device-bridge-disconnect", async () => {
  try {
    return { success: true, state: await deviceBridge.disconnect() };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});
ipcMain.handle("get-device-login-state", () => deviceLoginState);
ipcMain.handle("start-browser-login", async () => {
  if (!apiClient) return { success: false, error: "Studio belum siap. Coba lagi." };
  try {
    cancelDeviceLoginPolling();
    setDeviceLoginState({ status: "opening_browser" });
    const installationId = getOrCreateInstallationId();
    const authorization = await apiClient.startDeviceAuthorization({
      installationId,
      computerName: os.hostname(),
      platform: process.platform,
      appVersion: APP_VERSION,
    });
    await shell.openExternal(authorization.verificationUrl);
    setDeviceLoginState({
      status: "waiting",
      verificationUrl: authorization.verificationUrl,
      expiresAt: authorization.expiresAt,
    });
    scheduleDeviceLoginPoll(
      authorization.deviceCode,
      authorization.expiresAt,
      Math.max(2, authorization.intervalSeconds) * 1000,
      installationId,
    );
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setDeviceLoginState({ status: "error", message });
    return { success: false, error: message };
  }
});
ipcMain.handle("open-device-login-browser", async () => {
  if (deviceLoginState.status !== "waiting") return { success: false };
  await shell.openExternal(deviceLoginState.verificationUrl);
  return { success: true };
});
ipcMain.handle("studio-get-state", () => studioSession.getState());
ipcMain.handle("studio-get-roasting-context", async () => {
  if (!apiClient || !credentials) return { success: false, error: "Hubungkan Studio ke Roastd terlebih dahulu." };
  try {
    const context = await apiClient.getStudioRoastingContext(credentials.connectorToken);
    return { success: true, context };
  } catch (error) {
    return { success: false, error: error instanceof ApiError ? error.message : error instanceof Error ? error.message : String(error) };
  }
});
ipcMain.handle("studio-select-roasting-context", async (_event, data: { batchId: string }) => {
  if (!apiClient || !credentials) return { success: false, error: "Hubungkan Studio ke Roastd terlebih dahulu." };
  try {
    const result = await apiClient.selectStudioRoastingContext(
      data.batchId,
      credentials.connectorToken,
    );
    const state = studioSession.configureSelection(result.selection);
    return { success: true, selection: result.selection, state };
  } catch (error) {
    return { success: false, error: error instanceof ApiError ? error.message : error instanceof Error ? error.message : String(error) };
  }
});
ipcMain.handle("studio-clear-roasting-context", () => studioSession.configureSelection(null));
ipcMain.handle("studio-create-roasting-batch", async (_event, data) => {
  if (!apiClient || !credentials) return { success: false, error: "Hubungkan Studio ke Roastd terlebih dahulu." };
  try {
    const created = await apiClient.createStudioRoastingBatch(data, credentials.connectorToken);
    const context = await apiClient.getStudioRoastingContext(credentials.connectorToken);
    const batch = context.batches.find((item) => item.id === created.batch.id);
    if (!batch) throw new Error("Batch dibuat, tetapi belum tersedia di konteks Studio.");
    if (!created.batch.referenceProfileId) {
      const state = studioSession.configureSelection(null);
      return { success: true, batch: created.batch, state };
    }
    const selected = await apiClient.selectStudioRoastingContext(created.batch.id, credentials.connectorToken);
    const state = studioSession.configureSelection(selected.selection);
    return { success: true, batch: created.batch, selection: selected.selection, state };
  } catch (error) {
    return {
      success: false,
      error: error instanceof ApiError
        ? (["BATCH_UNAVAILABLE", "STUDIO_REAUTH_REQUIRED", "INVALID_BATCH"].includes(error.code) ? error.message : getErrorMessage(error.code))
        : error instanceof Error ? error.message : String(error),
    };
  }
});
ipcMain.handle("studio-start-simulator", (_event, data: StartSimulatorRequest) => {
  try {
    return { success: true, state: studioSession.startSimulator(data) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});
ipcMain.handle("studio-start-direct", async (_event, data: StartSimulatorRequest) => {
  try {
    const state = studioSession.startDirect(data);
    await deviceBridge.start();
    return { success: true, state };
  } catch (error) {
    studioSession.reset();
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});
ipcMain.handle("studio-mark-event", (_event, type: RoastStudioEventType) => {
  try {
    return { success: true, state: studioSession.markEvent(type) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});
ipcMain.handle("studio-finish-simulator", () => {
  try {
    return { success: true, state: studioSession.finishSimulator() };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});
ipcMain.handle("studio-finish-direct", async (_event, data: { roastedWeightGrams: number }) => {
  try {
    const state = studioSession.finishDirect(data.roastedWeightGrams);
    await deviceBridge.stop();
    return { success: true, state };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});
ipcMain.handle("studio-reset", async () => {
  if (studioSession.getState().source === "DIRECT") await deviceBridge.stop();
  return { success: true, state: studioSession.reset() };
});

// ─── Watcher & Queue ─────────────────────────────────────────────────────────

function startWatcher(folder: string): void {
  if (watcher) {
    watcher.stop();
  }

  watcher = new FolderWatcher(
    (filePath, filename, fileHash, fileSize, fileModifiedAt) => {
      const added = queue!.enqueue(filePath, filename, fileHash, fileModifiedAt);
      if (added) {
        mainWindow?.webContents.send("file-queued", { filename });
        processQueue();
      }
    },
  );

  watcher.start(folder);
  setStatus("connected");
  logger.info("Watcher started", { folder });
}

function persistFinishedStudioSession(state: RoastStudioState): void {
  if (state.status !== "FINISHED" || !state.sessionId || savedStudioSessions.has(state.sessionId)) return;
  try {
    const filePath = writeAlogProfile(state, APP_VERSION);
    savedStudioSessions.add(state.sessionId);
    let uploaded = false;

    if (state.source !== "SIMULATOR" && queue) {
      const contents = fs.readFileSync(filePath);
      const fileHash = crypto.createHash("sha256").update(contents).digest("hex");
      const stats = fs.statSync(filePath);
      uploaded = queue.enqueue(filePath, path.basename(filePath), fileHash, stats.mtime);
      if (uploaded) {
        mainWindow?.webContents.send("file-queued", { filename: path.basename(filePath) });
        void processQueue();
      }
    }

    mainWindow?.webContents.send("profile-saved", {
      sessionId: state.sessionId,
      filePath,
      filename: path.basename(filePath),
      uploaded,
    });
    logger.info("Studio profile saved", { filePath, source: state.source, uploaded });
    checkpointStore?.clear();
  } catch (error) {
    logger.error("Failed to save Studio .alog profile", {
      sessionId: state.sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    mainWindow?.webContents.send("profile-save-failed", {
      message: error instanceof Error ? error.message : "Profil .alog gagal disimpan.",
    });
  }
}

async function processQueue(): Promise<void> {
  if (!apiClient || !credentials || !queue) return;

  const item = queue.getNextPending();
  if (!item) return;

  queue.markUploading(item.id);

  const buffer = queue.getFileBuffer(item.absolute_path);
  if (!buffer) {
    queue.markFailed(item.id, "File not found");
    processQueue();
    return;
  }

  try {
    const result = await apiClient.uploadFile(
      buffer,
      item.filename,
      item.file_hash || "",
      item.file_modified_at || new Date().toISOString(),
      credentials.connectorToken,
    );

    if (result.success) {
      queue.markUploaded(item.id);
      mainWindow?.webContents.send("file-uploaded", {
        filename: item.filename,
        duplicate: result.duplicate,
        match: result.match ?? null,
        batchCompletion: result.batchCompletion ?? null,
      });
    } else {
      queue.markFailed(item.id, "Upload returned success=false");
    }
  } catch (err) {
    const code = err instanceof ApiError ? err.code : "UNKNOWN";
    const message = err instanceof Error ? err.message : String(err);

    if (code === "UNAUTHORIZED") {
      setStatus("auth_expired");
      clearCredentials();
      credentials = null;
      heartbeat?.stop();
      return;
    }

    queue.markFailed(item.id, `${code}: ${message}`);
  }

  // Process next item
  processQueue();
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

function cleanup(): void {
  if (deviceReconnectTimer) clearTimeout(deviceReconnectTimer);
  deviceReconnectTimer = null;
  watcher?.stop();
  heartbeat?.stop();
  mqttClient?.disconnect();
  deviceBridge.dispose();
  studioSession.dispose();
  cancelDeviceLoginPolling();
}

function setDeviceLoginState(state: DeviceLoginState): void {
  deviceLoginState = state;
  mainWindow?.webContents.send("device-login-state-change", state);
}

function cancelDeviceLoginPolling(): void {
  if (deviceLoginTimer) clearTimeout(deviceLoginTimer);
  deviceLoginTimer = null;
}

function scheduleDeviceLoginPoll(
  deviceCode: string,
  expiresAt: string,
  intervalMs: number,
  installationId: string,
): void {
  const poll = async () => {
    if (!apiClient || Date.now() >= new Date(expiresAt).getTime()) {
      setDeviceLoginState({ status: "error", message: "Waktu login habis. Coba lagi." });
      return;
    }
    try {
      const result = await apiClient.pollDeviceAuthorization(deviceCode);
      if (result.status === "pending") {
        deviceLoginTimer = setTimeout(poll, intervalMs);
        return;
      }

      credentials = {
        connectorId: result.connectorId,
        connectorToken: result.connectorToken,
        machineId: result.machine.id,
        machineName: result.machine.name,
        installationId,
        computerName: os.hostname(),
      };
      saveCredentials(credentials);
      setDeviceLoginState({ status: "authorized", machineName: result.machine.name });
      setConnected();
    } catch (error) {
      const code = error instanceof ApiError ? error.code : "UNKNOWN";
      if (code === "NETWORK_ERROR" || code === "TIMEOUT") {
        deviceLoginTimer = setTimeout(poll, Math.max(intervalMs, 5000));
        return;
      }
      setDeviceLoginState({
        status: "error",
        message: error instanceof Error ? error.message : "Login Studio gagal.",
      });
    }
  };

  deviceLoginTimer = setTimeout(poll, intervalMs);
}
