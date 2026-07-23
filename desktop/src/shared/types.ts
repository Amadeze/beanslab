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
}
