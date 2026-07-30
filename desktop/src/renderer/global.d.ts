import type {
  AppSettings,
  ConnectorCredentials,
  RoastStudioEventType,
  RoastStudioState,
  StartSimulatorRequest,
  DeviceLoginState,
  DetectedMachineDevice,
  DeviceBridgeConfig,
  DeviceBridgeSample,
  DeviceBridgeState,
  SavedAlogProfile,
  DiagnosticReportResult,
  StudioRoastingContext,
  StudioRoastSelection,
  CreateStudioRoastingBatchRequest,
  CreatedStudioRoastingBatch,
} from "../shared/types";

type StudioResult =
  | { success: true; state: RoastStudioState }
  | { success: false; error: string };

interface ElectronAPI {
  getStatus: () => Promise<string>;
  getCredentials: () => Promise<ConnectorCredentials | null>;
  getSettings: () => Promise<AppSettings>;
  updateSettings: (data: Partial<AppSettings>) => Promise<AppSettings>;
  pair: (data: { code: string }) => Promise<{ success: boolean; error?: string }>;
  getDeviceLoginState: () => Promise<DeviceLoginState>;
  startBrowserLogin: () => Promise<{ success: boolean; error?: string }>;
  openDeviceLoginBrowser: () => Promise<{ success: boolean }>;
  selectFolder: () => Promise<{ path?: string; error?: string; alogCount?: number } | null>;
  detectFolder: () => Promise<{ path: string | null; success: boolean }>;
  disconnect: () => Promise<{ success: boolean }>;
  openLogFolder: () => Promise<void>;
  openProfileFolder: () => Promise<string>;
  createDiagnosticReport: () => Promise<DiagnosticReportResult>;
  getQueueSize: () => Promise<number>;
  detectMachineDevices: () => Promise<DetectedMachineDevice[]>;
  getDeviceBridgeState: () => Promise<DeviceBridgeState>;
  connectDeviceBridge: (data: DeviceBridgeConfig) => Promise<{ success: true; state: DeviceBridgeState } | { success: false; error: string }>;
  testDeviceBridge: () => Promise<{ success: true; sample: DeviceBridgeSample; state: DeviceBridgeState } | { success: false; error: string }>;
  disconnectDeviceBridge: () => Promise<{ success: true; state: DeviceBridgeState } | { success: false; error: string }>;
  getStudioState: () => Promise<RoastStudioState>;
  getStudioRoastingContext: () => Promise<{ success: true; context: StudioRoastingContext } | { success: false; error: string }>;
  selectStudioRoastingContext: (data: { batchId: string }) => Promise<
    { success: true; selection: StudioRoastSelection; state: RoastStudioState } | { success: false; error: string }
  >;
  clearStudioRoastingContext: () => Promise<RoastStudioState>;
  createStudioRoastingBatch: (data: CreateStudioRoastingBatchRequest) => Promise<
    | { success: true; batch: CreatedStudioRoastingBatch; selection?: StudioRoastSelection; state: RoastStudioState }
    | { success: false; error: string }
  >;
  startSimulator: (data: StartSimulatorRequest) => Promise<StudioResult>;
  startDirectRoast: (data: StartSimulatorRequest) => Promise<StudioResult>;
  markStudioEvent: (type: RoastStudioEventType) => Promise<StudioResult>;
  finishSimulator: () => Promise<StudioResult>;
  finishDirectRoast: (data: { roastedWeightGrams: number }) => Promise<StudioResult>;
  resetStudio: () => Promise<StudioResult>;
  onStatusChange: (callback: (status: string) => void) => void;
  onConnected: (callback: (data: any) => void) => void;
  onDisconnected: (callback: () => void) => void;
  onFileQueued: (callback: (data: any) => void) => void;
  onFileUploaded: (callback: (data: any) => void) => void;
  onSyncNow: (callback: () => void) => void;
  onStudioStateChange: (callback: (state: RoastStudioState) => void) => void;
  onDeviceLoginStateChange: (callback: (state: DeviceLoginState) => void) => void;
  onProfileSaved: (callback: (profile: SavedAlogProfile) => void) => void;
  onProfileSaveFailed: (callback: (data: { message: string }) => void) => void;
  onDeviceBridgeStateChange: (callback: (state: DeviceBridgeState) => void) => void;
  onDeviceBridgeSample: (callback: (sample: DeviceBridgeSample) => void) => void;
}

declare global {
  type RoastdDeviceBridgeAdapter = DeviceBridgeAdapter;

  interface Window {
    electronAPI: ElectronAPI;
    __TAURI_INTERNALS__?: unknown;
  }
}

export {};
