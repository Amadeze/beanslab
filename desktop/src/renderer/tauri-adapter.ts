import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { RoastStudioSession } from "../main/roast-studio-session";
import type {
  CreateStudioRoastingBatchRequest,
  DeviceBridgeConfig,
  DeviceBridgeSample,
  DeviceBridgeState,
  DeviceLoginState,
  RoastStudioEventType,
  StartSimulatorRequest,
  StudioRoastSelection,
} from "../shared/types";

type Listener = (payload?: any) => void;
type DesktopCommand = { command: string; payload?: unknown };

const isTauri = "__TAURI_INTERNALS__" in window;
const hasDesktopApi = typeof (window as any).electronAPI === "object";

if (isTauri && !hasDesktopApi) {
  const listeners = new Map<string, Set<Listener>>();
  const session = new RoastStudioSession();

  const emit = (event: string, payload?: unknown) => {
    for (const listener of listeners.get(event) ?? []) listener(payload);
  };

  const subscribe = (event: string, callback: Listener) => {
    const bucket = listeners.get(event) ?? new Set<Listener>();
    bucket.add(callback);
    listeners.set(event, bucket);
  };

  const command = <T>(commandName: string, payload?: unknown): Promise<T> =>
    invoke<T>("desktop_command", { request: { command: commandName, payload } satisfies DesktopCommand });

  const studioResult = (action: () => unknown) => {
    try {
      return { success: true as const, state: action() };
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : String(error) };
    }
  };

  session.onChange((state) => emit("studio-state-change", state));

  void Promise.all([
    listen("status-change", (event) => emit("status-change", event.payload)),
    listen("connected", (event) => emit("connected", event.payload)),
    listen("disconnected", () => emit("disconnected")),
    listen("file-queued", (event) => emit("file-queued", event.payload)),
    listen("file-uploaded", (event) => emit("file-uploaded", event.payload)),
    listen("sync-now", () => emit("sync-now")),
    listen("device-login-state-change", (event) => emit("device-login-state-change", event.payload)),
    listen<DeviceBridgeState>("device-bridge-state-change", (event) => emit("device-bridge-state-change", event.payload)),
    listen<DeviceBridgeSample>("device-bridge-sample", (event) => {
      session.ingestDirect(event.payload);
      emit("device-bridge-sample", event.payload);
    }),
  ]);

  const api = {
    getStatus: () => command<string>("get-status"),
    getCredentials: () => command("get-credentials"),
    getSettings: () => command("get-settings"),
    updateSettings: (data: unknown) => command("update-settings", data),
    pair: (data: { code: string }) => command("pair", data),
    getDeviceLoginState: () => command<DeviceLoginState>("get-device-login-state"),
    startBrowserLogin: () => command("start-browser-login"),
    openDeviceLoginBrowser: () => command("open-device-login-browser"),
    selectFolder: () => command("select-folder"),
    detectFolder: () => command("detect-folder"),
    disconnect: () => command("disconnect"),
    openLogFolder: () => command("open-log-folder"),
    openProfileFolder: () => command("open-profile-folder"),
    createDiagnosticReport: () => command("create-diagnostic-report"),
    getQueueSize: () => command<number>("get-queue-size"),
    detectMachineDevices: () => command("detect-machine-devices"),
    getDeviceBridgeState: () => command<DeviceBridgeState>("device-bridge-get-state"),
    connectDeviceBridge: (data: DeviceBridgeConfig) => command("device-bridge-connect", data),
    testDeviceBridge: () => command("device-bridge-test"),
    disconnectDeviceBridge: () => command("device-bridge-disconnect"),
    getStudioState: async () => session.getState(),
    getStudioRoastingContext: () => command("studio-get-roasting-context"),
    selectStudioRoastingContext: async (data: { batchId: string }) => {
      const result = await command<{ success: true; selection: StudioRoastSelection } | { success: false; error: string }>(
        "studio-select-roasting-context",
        data,
      );
      if (!result.success) return result;
      const state = session.configureSelection(result.selection);
      return { ...result, state };
    },
    clearStudioRoastingContext: async () => session.configureSelection(null),
    createStudioRoastingBatch: async (data: CreateStudioRoastingBatchRequest) => {
      const result = await command<any>("studio-create-roasting-batch", data);
      if (!result.success) return result;
      const state = session.configureSelection(result.selection ?? null);
      return { ...result, state };
    },
    startSimulator: async (data: StartSimulatorRequest) => studioResult(() => session.startSimulator(data)),
    startDirectRoast: async (data: StartSimulatorRequest) => {
      const result = studioResult(() => session.startDirect(data));
      if (!result.success) return result;
      try {
        await command("device-bridge-start");
        return result;
      } catch (error) {
        session.reset();
        return { success: false as const, error: error instanceof Error ? error.message : String(error) };
      }
    },
    markStudioEvent: async (type: RoastStudioEventType) => studioResult(() => session.markEvent(type)),
    finishSimulator: async () => {
      const result = studioResult(() => session.finishSimulator());
      if (result.success) await saveProfile(result.state);
      return result;
    },
    finishDirectRoast: async (data: { roastedWeightGrams: number }) => {
      const result = studioResult(() => session.finishDirect(data.roastedWeightGrams));
      if (result.success) {
        await command("device-bridge-stop").catch(() => undefined);
        await saveProfile(result.state);
      }
      return result;
    },
    resetStudio: async () => {
      const wasDirect = session.getState().source === "DIRECT";
      if (wasDirect) await command("device-bridge-stop").catch(() => undefined);
      return studioResult(() => session.reset());
    },
    onStatusChange: (callback: Listener) => subscribe("status-change", callback),
    onConnected: (callback: Listener) => subscribe("connected", callback),
    onDisconnected: (callback: Listener) => subscribe("disconnected", callback),
    onFileQueued: (callback: Listener) => subscribe("file-queued", callback),
    onFileUploaded: (callback: Listener) => subscribe("file-uploaded", callback),
    onSyncNow: (callback: Listener) => subscribe("sync-now", callback),
    onStudioStateChange: (callback: Listener) => subscribe("studio-state-change", callback),
    onDeviceLoginStateChange: (callback: Listener) => subscribe("device-login-state-change", callback),
    onProfileSaved: (callback: Listener) => subscribe("profile-saved", callback),
    onProfileSaveFailed: (callback: Listener) => subscribe("profile-save-failed", callback),
    onDeviceBridgeStateChange: (callback: Listener) => subscribe("device-bridge-state-change", callback),
    onDeviceBridgeSample: (callback: Listener) => subscribe("device-bridge-sample", callback),
  };

  const saveProfile = async (state: unknown) => {
    try {
      const profile = await command("studio-save-profile", state);
      emit("profile-saved", profile);
    } catch (error) {
      emit("profile-save-failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  Object.defineProperty(window, "electronAPI", {
    configurable: false,
    enumerable: true,
    writable: false,
    value: api,
  });
}
