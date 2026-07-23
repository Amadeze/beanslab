interface ElectronAPI {
  getStatus: () => Promise<string>;
  getCredentials: () => Promise<any>;
  getSettings: () => Promise<any>;
  pair: (data: { code: string }) => Promise<{ success: boolean; error?: string }>;
  selectFolder: () => Promise<string | null>;
  disconnect: () => Promise<{ success: boolean }>;
  openLogFolder: () => Promise<void>;
  getQueueSize: () => Promise<number>;
  onStatusChange: (callback: (status: string) => void) => void;
  onConnected: (callback: (data: any) => void) => void;
  onDisconnected: (callback: () => void) => void;
  onFileQueued: (callback: (data: any) => void) => void;
  onFileUploaded: (callback: (data: any) => void) => void;
  onSyncNow: (callback: () => void) => void;
}

interface Window {
  electronAPI: ElectronAPI;
}
