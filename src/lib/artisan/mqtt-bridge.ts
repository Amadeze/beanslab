import { Prisma } from "@prisma/client";
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
const ACTIVE_EVENTS_CAP = 1000;
const ACQUISITION_MAX_ATTEMPTS = 3;
const APPEND_MAX_ATTEMPTS = 3;

type LiveEvent = {
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
};

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError
    && error.code === "P2002"
  );
}

/**
 * Atomically append a telemetry event to the acquired ACTIVE session.
 *
 * The event is appended with a single parameterized UPDATE: the database
 * performs `events || newEvent` (jsonb concat) instead of a read-modify-write,
 * so two parallel appends can never overwrite each other's events. Ownership
 * is re-verified inside the UPDATE via tenantId + machineId + status.
 *
 * The bounded append keeps only the newest ACTIVE_EVENTS_CAP events by
 * removing array index 0 once the cap is reached, preserving the previous
 * "keep last 1000" behaviour atomically.
 *
 * Returns the number of affected rows. A result of 0 means the session is no
 * longer ACTIVE (it was completed/reconciled between acquisition and append):
 * the event was NOT stored, and the caller must reacquire and retry. A result
 * of 1 means the event was appended exactly once.
 *
 * Technical debt: jsonb is immutable, so every append rewrites the whole
 * array (write amplification). Lost updates are fixed; write amplification
 * remains documented debt (an append-only table would be the long-term fix).
 */
export async function appendLiveEvent(
  sessionRowId: string,
  tenantId: string,
  machineId: string,
  receivedAt: Date,
  event: LiveEvent,
): Promise<number> {
  const btValue = typeof event.data.BT === "number" ? event.data.BT : null;
  const etValue = typeof event.data.ET === "number" ? event.data.ET : null;

  const affected = await prisma.$executeRaw`
    UPDATE "live_sessions"
    SET "events" = CASE
          WHEN jsonb_array_length("events") < ${ACTIVE_EVENTS_CAP}
            THEN "events" || ${JSON.stringify(event)}::jsonb
            ELSE ("events" || ${JSON.stringify(event)}::jsonb) - 0
        END,
        "lastUpdateAt" = ${receivedAt.toISOString()}::timestamp(3),
        "currentBT" = COALESCE(${btValue}, "currentBT"),
        "currentET" = COALESCE(${etValue}, "currentET")
    WHERE "id" = ${sessionRowId}
      AND "tenantId" = ${tenantId}
      AND "machineId" = ${machineId}
      AND "status" = 'ACTIVE'
  `;
  return affected;
}

/**
 * Acquire the single ACTIVE LiveSession for (tenantId, machineId).
 *
 * Fast path: look up the existing ACTIVE session first and return it without
 * paying for a doomed INSERT (P2002) on every telemetry event. Only when no
 * ACTIVE session exists is a new one created. If the create collides on the
 * partial unique index `live_sessions_active_unique` (see migration), another
 * request won the race, so the lookup is repeated. Retries are bounded
 * (ACQUISITION_MAX_ATTEMPTS). Any error other than the expected collision is
 * rethrown, never swallowed. The database index remains the invariant guard.
 */
async function acquireActiveSession(
  tenantId: string,
  machineId: string,
): Promise<{ id: string; sessionId: string }> {
  for (let attempt = 1; attempt <= ACQUISITION_MAX_ATTEMPTS; attempt++) {
    const existing = await prisma.liveSession.findFirst({
      where: {
        tenantId,
        machineId,
        status: "ACTIVE",
      },
      orderBy: { startedAt: "desc" },
      select: { id: true, sessionId: true },
    });
    if (existing) return existing;

    try {
      const created = await prisma.liveSession.create({
        data: {
          tenantId,
          machineId,
          sessionId: `live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          status: "ACTIVE",
          lastUpdateAt: new Date(),
        },
        select: { id: true, sessionId: true },
      });

      logInfo("mqtt.live", "New live session created", {
        sessionId: created.sessionId,
        machineId,
        tenantId,
      });
      return created;
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }

      // Another request created the ACTIVE session between our lookup and our
      // create; loop back and re-lookup instead of returning a stale result.
    }
  }

  throw new Error(
    `Could not acquire an active live session for machine ${machineId} after ${ACQUISITION_MAX_ATTEMPTS} attempts.`,
  );
}

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
    await prisma.roastdStudio.updateMany({
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

  // Acquire the single ACTIVE session, then append the telemetry event.
  //
  // The session can be completed/reconciled between acquire and append (e.g. by
  // a concurrent reconcileLiveSession). The UPDATE then affects 0 rows and the
  // event was NOT stored, so reacquire a fresh ACTIVE session and retry.
  // Bounded (APPEND_MAX_ATTEMPTS), no sleeps. A 0-row append writes nothing, so
  // retrying can never store the event twice; an event is returned to the
  // caller only after an append that actually affected one row.
  let session = await acquireActiveSession(tenantId, machineId);
  let appended = false;
  for (let attempt = 1; attempt <= APPEND_MAX_ATTEMPTS; attempt++) {
    const affected = await appendLiveEvent(
      session.id,
      tenantId,
      machineId,
      receivedAt,
      {
        type: eventType,
        timestamp: receivedAt.toISOString(),
        data,
      },
    );

    if (affected === 1) {
      appended = true;
      break;
    }
    session = await acquireActiveSession(tenantId, machineId);
  }

  if (!appended) {
    throw new Error(
      `Could not append telemetry event to an active live session for machine ${machineId} after ${APPEND_MAX_ATTEMPTS} attempts.`,
    );
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
