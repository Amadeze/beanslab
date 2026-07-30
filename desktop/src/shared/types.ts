// Shared types matching backend API contracts

export interface PairConnectorRequest {
  pairingCode: string;
  installationId: string;
  computerName: string;
  platform: string;
  appVersion: string;
}

export interface PairConnectorResponse {
  connectorId: string;
  connectorToken: string;
  machine: {
    id: string;
    name: string;
  };
}

export interface StartDeviceAuthorizationRequest {
  installationId: string;
  computerName: string;
  platform: string;
  appVersion: string;
}

export interface StartDeviceAuthorizationResponse {
  deviceCode: string;
  verificationUrl: string;
  expiresAt: string;
  intervalSeconds: number;
}

export type PollDeviceAuthorizationResponse =
  | { status: "pending" }
  | {
      status: "authorized";
      connectorId: string;
      connectorToken: string;
      machine: { id: string; name: string };
    };

export type DeviceLoginState =
  | { status: "idle" }
  | { status: "opening_browser" }
  | { status: "waiting"; verificationUrl: string; expiresAt: string }
  | { status: "authorized"; machineName: string }
  | { status: "error"; message: string };

export interface HeartbeatRequest {
  appVersion: string;
  computerName: string;
  queueSize: number;
  watchFolderConfigured: boolean;
}

export interface HeartbeatResponse {
  success: boolean;
}

export interface UploadResponse {
  success: boolean;
  duplicate: boolean;
  importId: string;
  roastId: string | null;
  batchId?: string | null;
  batchCompletion?: {
    status: "WAITING_FOR_CHILDREN" | "WAITING_FOR_OUTPUT_WEIGHT" | "REVIEW_REQUIRED" | "ALREADY_COMPLETED" | "COMPLETED" | "ERROR";
    remainingChildren?: number;
    missingChildren?: number;
    actualOutputKg?: number;
    message?: string;
  } | null;
  match?: RoastProfileMatch | null;
}

export interface StandardError {
  error: {
    code: string;
    message: string;
  };
}

export type AppStatus =
  | "pairing"
  | "connected"
  | "offline"
  | "syncing"
  | "auth_expired"
  | "folder_unavailable";

export interface ConnectorCredentials {
  connectorId: string;
  connectorToken: string;
  machineId: string;
  machineName: string;
  installationId: string;
  computerName: string;
}

export interface AppSettings {
  watchFolder: string | null;
  autoLaunch: boolean;
  apiBaseUrl: string;
  mqttBrokerUrl: string | null;
  /** Full machine reader configuration. Legacy serial fields remain for migration. */
  deviceConfig: DeviceBridgeConfig | null;
  autoReconnectDevice: boolean;
  selectedSerialPort: string | null;
  serialAdapter: DeviceBridgeAdapter;
  serialBaudRate: number;
}

export type DeviceBridgeAdapter =
  | "AUTO"
  | "ARTISAN_TC4"
  | "AILLIO_R1"
  | "AILLIO_R2"
  | "HOTTOP"
  | "SANTOKER"
  | "SANTOKER_R"
  | "KALEIDO"
  | "MODBUS_RTU"
  | "MODBUS_TCP"
  | "PHIDGET"
  | "GENERIC_LINE";
export type DeviceBridgeStatus = "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "STREAMING" | "ERROR";

export interface DeviceBridgeConfig {
  port: string;
  adapter: DeviceBridgeAdapter;
  baudRate: number;
  intervalMs?: number;
  host?: string;
  networkPort?: number;
  transport?: "SERIAL" | "USB" | "NETWORK" | "BLE";
  unitId?: number;
  btRegister?: number;
  etRegister?: number;
  functionCode?: 3 | 4;
  scale?: number;
  offset?: number;
  btChannel?: number;
  etChannel?: number;
  serialNumber?: number;
  /** Final per-channel calibration, applied after the machine driver reading. */
  swapBtEt?: boolean;
  btOffset?: number;
  etOffset?: number;
  btScale?: number;
  etScale?: number;
}

export interface DeviceBridgeSample {
  bt: number | null;
  et: number | null;
  at: number;
  heater?: number | null;
  fan?: number | null;
  drum?: number | null;
  pressure?: number | null;
  machineState?: string | number | null;
}

export interface DeviceBridgeState {
  status: DeviceBridgeStatus;
  port: string | null;
  adapter: DeviceBridgeAdapter | null;
  latestSample: DeviceBridgeSample | null;
  error: string | null;
  sampleCount?: number;
  dataGapCount?: number;
  lastSampleAt?: string | null;
}

export interface DiagnosticReportResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export type MachineDeviceConfidence = "IDENTIFIED" | "LIKELY" | "GENERIC";

export interface DetectedMachineDevice {
  path: string;
  name: string;
  manufacturer: string | null;
  vendorId: string | null;
  productId: string | null;
  serialNumber: string | null;
  confidence: MachineDeviceConfidence;
  adapter?: DeviceBridgeAdapter;
  transport?: "SERIAL" | "USB" | "NETWORK" | "BLE";
}

export type RoastStudioSource = "SIMULATOR" | "MQTT" | "DIRECT";
export type RoastStudioStatus = "IDLE" | "RECORDING" | "FINISHED";
export type RoastStudioEventType = "CHARGE" | "TP" | "DRY_END" | "FCs" | "FCe" | "SCs" | "DROP";

export interface RoastStudioPoint {
  second: number;
  bt: number | null;
  et: number | null;
  ror: number | null;
  heater?: number | null;
  fan?: number | null;
  drum?: number | null;
  pressure?: number | null;
  machineState?: string | number | null;
}

export interface RoastStudioEvent {
  type: RoastStudioEventType;
  second: number;
  bt: number | null;
}

export interface RoastReferenceProfile {
  id: string;
  title: string;
  machineId: string;
  durationSeconds: number | null;
  greenWeightGrams: number | null;
  points: RoastStudioPoint[];
  events: RoastStudioEvent[];
}

export interface StudioBatchOption {
  id: string;
  code: string;
  inputProductName: string;
  targetWeightGrams: number;
  pendingChildCount: number;
  referenceProfileId: string | null;
}

export interface StudioProfileSummary {
  id: string;
  title: string;
  roastDate: string | null;
  durationSeconds: number | null;
  greenWeightGrams: number | null;
}

export type StudioRoastLevel = "LIGHT" | "MEDIUM" | "MEDIUM_DARK" | "DARK";

export interface StudioGreenBeanOption {
  id: string;
  name: string;
  origin: string | null;
  stockKg: number;
  nextLot: {
    lotNumber: string;
    expiryDate: string | null;
    remainingKg: number;
  } | null;
  suggestedRoastLevel: StudioRoastLevel;
  recommendedProfileId: string | null;
}

export interface StudioRoastingContext {
  batches: StudioBatchOption[];
  profiles: StudioProfileSummary[];
  greenBeans: StudioGreenBeanOption[];
  machineCapacityKg: number | null;
}

export interface CreateStudioRoastingBatchRequest {
  operationKey: string;
  inputProductId: string;
  targetWeightKg: number;
  roastLevel: StudioRoastLevel;
}

export interface CreatedStudioRoastingBatch {
  id: string;
  code: string;
  childCount: number;
  targetChargeWeightGrams: number;
  referenceProfileId: string | null;
}

export interface StudioRoastSelection {
  batchId: string;
  batchCode: string;
  inputProductName: string;
  targetWeightGrams: number;
  referenceProfile: RoastReferenceProfile;
}

export type RoastMatchStatus = "NO_TARGET" | "ON_TRACK" | "WATCH" | "DIVERGED" | "INVALID";

export interface RoastEventDelta {
  type: RoastStudioEventType;
  actualSecond: number;
  targetSecond: number;
  deltaSeconds: number;
}

export interface RoastProfileMatch {
  algorithmVersion: "roastd-v1";
  status: RoastMatchStatus;
  score: number | null;
  coveragePercent: number;
  btRmse: number | null;
  rorRmse: number | null;
  durationDeltaSeconds: number | null;
  latestBtDelta: number | null;
  latestRorDelta: number | null;
  eventDeltas: RoastEventDelta[];
  message: string;
}

export interface RoastStudioState {
  status: RoastStudioStatus;
  source: RoastStudioSource | null;
  sessionId: string | null;
  title: string;
  greenWeightGrams: number | null;
  roastedWeightGrams: number | null;
  startedAt: string | null;
  elapsedSeconds: number;
  points: RoastStudioPoint[];
  events: RoastStudioEvent[];
  selection: StudioRoastSelection | null;
  match: RoastProfileMatch | null;
}

export interface StartSimulatorRequest {
  title: string;
  greenWeightGrams: number;
}

export interface SavedAlogProfile {
  sessionId: string;
  filePath: string;
  filename: string;
  uploaded: boolean;
}
