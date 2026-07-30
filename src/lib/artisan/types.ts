import { z } from "zod";

// =============================================================================
// Pairing Code
// =============================================================================

export const CreatePairingCodeSchema = z.object({
  machineId: z.string().min(1),
});

export const PairingCodeResponseSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
  expiresAt: z.string().datetime(),
});

// =============================================================================
// Connector Pairing
// =============================================================================

export const PairConnectorRequestSchema = z.object({
  pairingCode: z.string().regex(/^\d{6}$/),
  installationId: z.string().uuid(),
  computerName: z.string().min(1).max(100),
  platform: z.string().min(1).max(50),
  appVersion: z.string().min(1).max(20),
});

export const PairConnectorResponseSchema = z.object({
  connectorId: z.string(),
  connectorToken: z.string(),
  machine: z.object({
    id: z.string(),
    name: z.string(),
  }),
});

export const StartStudioDeviceAuthorizationSchema = z.object({
  installationId: z.string().uuid(),
  computerName: z.string().trim().min(1).max(100),
  platform: z.string().trim().min(1).max(50),
  appVersion: z.string().trim().min(1).max(20),
});

export const PollStudioDeviceAuthorizationSchema = z.object({
  deviceCode: z.string().min(32).max(128),
});

// =============================================================================
// Heartbeat
// =============================================================================

export const HeartbeatRequestSchema = z.object({
  appVersion: z.string().min(1).max(20),
  computerName: z.string().min(1).max(100),
  queueSize: z.number().int().nonnegative(),
  watchFolderConfigured: z.boolean(),
});

export const HeartbeatResponseSchema = z.object({
  success: z.boolean(),
});

// =============================================================================
// MQTT Live Telemetry
// =============================================================================

export const MqttSessionRequestSchema = z.object({
  eventType: z.string().min(1),
  data: z.record(z.string(), z.unknown()).optional(),
});

export const MqttSessionResponseSchema = z.object({
  success: z.boolean(),
  sessionId: z.string(),
  status: z.string(),
});

// =============================================================================
// Upload
// =============================================================================

export const UploadResponseSchema = z.object({
  success: z.boolean(),
  duplicate: z.boolean(),
  importId: z.string(),
  roastId: z.string().nullable(),
});

export const SelectStudioRoastContextSchema = z.object({
  batchId: z.string().min(1),
});

export const CreateStudioRoastingBatchSchema = z.object({
  operationKey: z.string().uuid(),
  inputProductId: z.string().min(1),
  targetWeightKg: z.number().positive().max(10_000),
  roastLevel: z.enum(["LIGHT", "MEDIUM", "MEDIUM_DARK", "DARK"]),
});

// =============================================================================
// Error
// =============================================================================

export const StandardErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type StandardError = z.infer<typeof StandardErrorResponseSchema>;

// =============================================================================
// Parsed Artisan Roast (for future parser)
// =============================================================================

export type ParsedArtisanRoast = {
  source: "artisan";
  sourceVersion?: string;
  title?: string;
  roastDate?: string;
  chargeTime?: number;
  dropTime?: number;
  durationSeconds?: number;
  chargeTemperature?: number;
  dropTemperature?: number;
  dryEndTime?: number;
  firstCrackStartTime?: number;
  firstCrackEndTime?: number;
  secondCrackStartTime?: number;
  secondCrackEndTime?: number;
  beanTemperatureSeries: Array<{ second: number; value: number }>;
  environmentalTemperatureSeries: Array<{ second: number; value: number }>;
  events: Array<{
    second: number;
    type: string;
    value?: string | number;
    label?: string;
  }>;
  metadata: Record<string, unknown>;
};
