import { prisma } from "@/lib/prisma";
import { logInfo } from "@/lib/api-observability";

export type MqttLivePayload = {
  eventType: string; // CHARGE, TP, FCs, FCe, SCs, DROP, BT_UPDATE, ET_UPDATE
  data: {
    BT?: number;
    ET?: number;
    timestamp?: string;
    [key: string]: unknown;
  };
};

const SESSION_RESUME_WINDOW_MS = 5 * 60 * 1000;

/**
 * Process MQTT live telemetry data.
 * Creates or updates a LiveSession for the given machine.
 */
export async function processMqttLive(
  tenantId: string,
  machineId: string,
  payload: MqttLivePayload,
  connectorId?: string,
): Promise<{ sessionId: string; status: string }> {
  const { eventType, data } = payload;
  const receivedAt = new Date();

  // Telemetry is also proof that the desktop connector is alive. Keeping this
  // in the same ingestion path prevents "connector offline / telemetry active"
  // contradictions when a heartbeat is delayed.
  if (connectorId) {
    await prisma.artisanConnector.updateMany({
      where: {
        id: connectorId,
        tenantId,
        machineId,
        revokedAt: null,
      },
      data: {
        lastSeenAt: receivedAt,
        status: "ONLINE",
      },
    });
  }

  await prisma.liveSession.updateMany({
    where: {
      tenantId,
      machineId,
      status: "ACTIVE",
      lastUpdateAt: {
        lt: new Date(receivedAt.getTime() - SESSION_RESUME_WINDOW_MS),
      },
    },
    data: {
      status: "COMPLETED",
    },
  });

  // Find or create active session for this machine
  let session = await prisma.liveSession.findFirst({
    where: {
      tenantId,
      machineId,
      status: "ACTIVE",
    },
    orderBy: { startedAt: "desc" },
  });

  if (!session) {
    // Create new session
    const initialEvent = {
      type: eventType,
      timestamp: receivedAt.toISOString(),
      data: data as Record<string, unknown>,
    };
    session = await prisma.liveSession.create({
      data: {
        tenantId,
        machineId,
        sessionId: `live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        status: "ACTIVE",
        lastUpdateAt: receivedAt,
        currentBT: data.BT ?? null,
        currentET: data.ET ?? null,
        events: JSON.parse(JSON.stringify([initialEvent])),
      },
    });

    logInfo("mqtt.live", "New live session created", {
      sessionId: session.sessionId,
      machineId,
      tenantId,
    });
  } else {
    // Update existing session
    const events = (session.events as any[]) || [];
    events.push({
      type: eventType,
      timestamp: receivedAt.toISOString(),
      data: data as Record<string, unknown>,
    });

    // Keep last 1000 events
    const trimmedEvents = events.slice(-1000);

    await prisma.liveSession.update({
      where: { id: session.id },
      data: {
        lastUpdateAt: receivedAt,
        currentBT: data.BT ?? session.currentBT,
        currentET: data.ET ?? session.currentET,
        events: JSON.parse(JSON.stringify(trimmedEvents)),
      },
    });
  }

  return {
    sessionId: session.sessionId,
    status: "ACTIVE",
  };
}

/**
 * Reconcile a LiveSession with a final .alog upload.
 * Called when a Roast record is created from a .alog file.
 */
export async function reconcileLiveSession(
  tenantId: string,
  machineId: string,
  roastId: string,
  roastData: {
    chargeTime?: number;
    dropTime?: number;
    duration?: number;
    chargeTemperature?: number;
    dropTemperature?: number;
    events?: Array<{ second: number; type: string }>;
  },
): Promise<void> {
  // Find active session for this machine
  const session = await prisma.liveSession.findFirst({
    where: {
      tenantId,
      machineId,
      status: "ACTIVE",
    },
    orderBy: { lastUpdateAt: "desc" },
  });

  if (!session) {
    logInfo("mqtt.reconcile", "No active session to reconcile", { machineId });
    return;
  }

  // Mark session as reconciled
  await prisma.liveSession.update({
    where: { id: session.id },
    data: {
      status: "RECONCILED",
      lastUpdateAt: new Date(),
    },
  });

  // Merge live events into roast metadata if available
  const liveEvents = (session.events as any[]) || [];
  if (liveEvents.length > 0) {
    const metadata = {
      ...(roastData as Record<string, unknown>),
      liveSessionId: session.sessionId,
      liveEventsCount: liveEvents.length,
      liveEvents: liveEvents.slice(-50), // Keep last 50 live events
    };
    await prisma.roast.update({
      where: { id: roastId },
      data: {
        metadata: JSON.parse(JSON.stringify(metadata)),
      },
    });
  }

  logInfo("mqtt.reconcile", "Live session reconciled with roast", {
    sessionId: session.sessionId,
    roastId,
    liveEventsCount: liveEvents.length,
  });
}

/**
 * Cleanup stale sessions (older than 1 hour without updates).
 */
export async function cleanupStaleSessions(): Promise<number> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const result = await prisma.liveSession.updateMany({
    where: {
      status: "ACTIVE",
      lastUpdateAt: { lt: oneHourAgo },
    },
    data: {
      status: "COMPLETED",
    },
  });

  if (result.count > 0) {
    logInfo("mqtt.cleanup", `Cleaned up ${result.count} stale sessions`);
  }

  return result.count;
}
