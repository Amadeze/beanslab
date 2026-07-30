import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  // Status
  getStatus: () => ipcRenderer.invoke("get-status"),
  getCredentials: () => ipcRenderer.invoke("get-credentials"),
  getSettings: () => ipcRenderer.invoke("get-settings"),
  updateSettings: (data: any) => ipcRenderer.invoke("update-settings", data),

  // Pairing
  pair: (data: { code: string }) => ipcRenderer.invoke("pair", data),
  getDeviceLoginState: () => ipcRenderer.invoke("get-device-login-state"),
  startBrowserLogin: () => ipcRenderer.invoke("start-browser-login"),
  openDeviceLoginBrowser: () => ipcRenderer.invoke("open-device-login-browser"),

  // Folder selection
  selectFolder: () => ipcRenderer.invoke("select-folder"),
  detectFolder: () => ipcRenderer.invoke("detect-folder"),

  // Disconnect
  disconnect: () => ipcRenderer.invoke("disconnect"),

  // Logs
  openLogFolder: () => ipcRenderer.invoke("open-log-folder"),
  openProfileFolder: () => ipcRenderer.invoke("open-profile-folder"),
  createDiagnosticReport: () => ipcRenderer.invoke("create-diagnostic-report"),

  // Queue
  getQueueSize: () => ipcRenderer.invoke("get-queue-size"),
  detectMachineDevices: () => ipcRenderer.invoke("detect-machine-devices"),
  getDeviceBridgeState: () => ipcRenderer.invoke("device-bridge-get-state"),
  connectDeviceBridge: (data: unknown) => ipcRenderer.invoke("device-bridge-connect", data),
  testDeviceBridge: () => ipcRenderer.invoke("device-bridge-test"),
  disconnectDeviceBridge: () => ipcRenderer.invoke("device-bridge-disconnect"),

  // Roastd Studio
  getStudioState: () => ipcRenderer.invoke("studio-get-state"),
  getStudioRoastingContext: () => ipcRenderer.invoke("studio-get-roasting-context"),
  selectStudioRoastingContext: (data: { batchId: string }) =>
    ipcRenderer.invoke("studio-select-roasting-context", data),
  clearStudioRoastingContext: () => ipcRenderer.invoke("studio-clear-roasting-context"),
  createStudioRoastingBatch: (data: unknown) =>
    ipcRenderer.invoke("studio-create-roasting-batch", data),
  startSimulator: (data: { title: string; greenWeightGrams: number }) =>
    ipcRenderer.invoke("studio-start-simulator", data),
  startDirectRoast: (data: { title: string; greenWeightGrams: number }) =>
    ipcRenderer.invoke("studio-start-direct", data),
  markStudioEvent: (type: string) => ipcRenderer.invoke("studio-mark-event", type),
  finishSimulator: () => ipcRenderer.invoke("studio-finish-simulator"),
  finishDirectRoast: (data: { roastedWeightGrams: number }) =>
    ipcRenderer.invoke("studio-finish-direct", data),
  resetStudio: () => ipcRenderer.invoke("studio-reset"),

  // Events from main process
  onStatusChange: (callback: (status: string) => void) => {
    ipcRenderer.on("status-change", (_event, status) => callback(status));
  },
  onConnected: (callback: (data: unknown) => void) => {
    ipcRenderer.on("connected", (_event, data) => callback(data));
  },
  onDisconnected: (callback: () => void) => {
    ipcRenderer.on("disconnected", () => callback());
  },
  onFileQueued: (callback: (data: unknown) => void) => {
    ipcRenderer.on("file-queued", (_event, data) => callback(data));
  },
  onFileUploaded: (callback: (data: unknown) => void) => {
    ipcRenderer.on("file-uploaded", (_event, data) => callback(data));
  },
  onSyncNow: (callback: () => void) => {
    ipcRenderer.on("sync-now", () => callback());
  },
  onStudioStateChange: (callback: (state: unknown) => void) => {
    ipcRenderer.on("studio-state-change", (_event, state) => callback(state));
  },
  onDeviceLoginStateChange: (callback: (state: unknown) => void) => {
    ipcRenderer.on("device-login-state-change", (_event, state) => callback(state));
  },
  onProfileSaved: (callback: (profile: unknown) => void) => {
    ipcRenderer.on("profile-saved", (_event, profile) => callback(profile));
  },
  onProfileSaveFailed: (callback: (data: unknown) => void) => {
    ipcRenderer.on("profile-save-failed", (_event, data) => callback(data));
  },
  onDeviceBridgeStateChange: (callback: (state: unknown) => void) => {
    ipcRenderer.on("device-bridge-state-change", (_event, state) => callback(state));
  },
  onDeviceBridgeSample: (callback: (sample: unknown) => void) => {
    ipcRenderer.on("device-bridge-sample", (_event, sample) => callback(sample));
  },
});
