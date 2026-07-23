import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  // Status
  getStatus: () => ipcRenderer.invoke("get-status"),
  getCredentials: () => ipcRenderer.invoke("get-credentials"),
  getSettings: () => ipcRenderer.invoke("get-settings"),

  // Pairing
  pair: (data: { code: string }) => ipcRenderer.invoke("pair", data),

  // Folder selection
  selectFolder: () => ipcRenderer.invoke("select-folder"),

  // Disconnect
  disconnect: () => ipcRenderer.invoke("disconnect"),

  // Logs
  openLogFolder: () => ipcRenderer.invoke("open-log-folder"),

  // Queue
  getQueueSize: () => ipcRenderer.invoke("get-queue-size"),

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
});
