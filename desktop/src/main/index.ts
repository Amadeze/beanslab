import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import * as path from "path";
import * as os from "os";
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
import { SystemTray } from "./tray";
import { logger } from "./logger";
import type {
  AppStatus,
  ConnectorCredentials,
  AppSettings,
} from "../shared/types";
import { getErrorMessage } from "../shared/errors";

const APP_VERSION = app.getVersion();
const SINGLE_INSTANCE_LOCK = "artisan-sync-single-instance";

let mainWindow: BrowserWindow | null = null;
let tray: SystemTray | null = null;
let apiClient: ApiClient | null = null;
let credentials: ConnectorCredentials | null = null;
let settings: AppSettings;
let watcher: FolderWatcher | null = null;
let queue: UploadQueue | null = null;
let heartbeat: HeartbeatSender | null = null;
let currentStatus: AppStatus = "pairing";

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
    queue = new UploadQueue();
    await queue.init();

    console.log("[DEBUG] Queue initialized, creating window...");

    // Create main window
    createWindow();

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
        logger.warn("Credentials invalid, clearing and showing pairing", { code });
        clearCredentials();
        credentials = null;
        setStatus("pairing");
      }
    } else {
      setStatus("pairing");
    }

    logger.info("App started", { version: APP_VERSION });
  });

  app.on("window-all-closed", () => {
    // Keep running in tray
  });

  app.on("before-quit", () => {
    cleanup();
  });
}

// ─── Window ──────────────────────────────────────────────────────────────────

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 640,
    resizable: false,
    maximizable: false,
    title: "Artisan Sync",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    show: true,
  });

  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));

  mainWindow.on("close", (e) => {
    // Minimize to tray instead of quitting
    e.preventDefault();
    mainWindow?.hide();
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
  settings.watchFolder = folder;
  saveSettings(settings);

  startWatcher(folder);

  return folder;
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

ipcMain.handle("get-queue-size", () => queue!.getPendingCount());

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
  watcher?.stop();
  heartbeat?.stop();
}
