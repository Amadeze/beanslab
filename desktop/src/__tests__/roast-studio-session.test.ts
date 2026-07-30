import { afterEach, describe, expect, it, vi } from "vitest";
import { createSimulatorPoint, RoastStudioSession } from "../main/roast-studio-session";

describe("Roastd Studio session", () => {
  afterEach(() => vi.useRealTimers());

  it("creates a rising, deterministic simulator curve", () => {
    const start = createSimulatorPoint(0);
    const minuteTen = createSimulatorPoint(600);

    expect(start.bt).toBe(30);
    expect(minuteTen.bt).toBeGreaterThan(200);
    expect(minuteTen.et).toBeGreaterThan(start.et ?? 0);
    expect(minuteTen.ror).toBeGreaterThan(0);
  });

  it("runs a simulator without producing a production upload", () => {
    vi.useFakeTimers();
    const session = new RoastStudioSession();
    session.startSimulator({ title: "Latihan Natural", greenWeightGrams: 5000 });
    vi.advanceTimersByTime(5000);
    session.markEvent("TP");
    const finished = session.finishSimulator();

    expect(finished.source).toBe("SIMULATOR");
    expect(finished.elapsedSeconds).toBe(5);
    expect(finished.events.map((event) => event.type)).toEqual(["CHARGE", "TP", "DROP"]);
    expect(finished.status).toBe("FINISHED");
    session.dispose();
  });

  it("turns MQTT readings and machine events into a live session", () => {
    const session = new RoastStudioSession();
    session.ingestMqtt({ eventType: "CHARGE", data: { BT: 31, ET: 190, timestamp: "2026-07-28T00:00:00.000Z" } });
    const live = session.ingestMqtt({ eventType: "BT_UPDATE", data: { BT: 35, ET: 192, timestamp: "2026-07-28T00:00:10.000Z" } });

    expect(live.source).toBe("MQTT");
    expect(live.elapsedSeconds).toBe(10);
    expect(live.points).toHaveLength(2);
    expect(live.points[1].ror).toBe(24);
    expect(live.events[0].type).toBe("CHARGE");
    session.dispose();
  });

  it("carries the selected batch profile into a roast and updates live matching", () => {
    const session = new RoastStudioSession();
    session.configureSelection({
      batchId: "batch-1",
      batchCode: "PRST-001",
      inputProductName: "Gayo Natural",
      targetWeightGrams: 5000,
      referenceProfile: {
        id: "reference-1",
        title: "Gayo Medium v2",
        machineId: "machine-1",
        durationSeconds: 600,
        greenWeightGrams: 5000,
        points: [createSimulatorPoint(0), createSimulatorPoint(60)],
        events: [{ type: "CHARGE", second: 0, bt: 30 }],
      },
    });

    const live = session.ingestMqtt({
      eventType: "CHARGE",
      data: { BT: 30, ET: 184, timestamp: "2026-07-28T00:00:00.000Z" },
    });

    expect(live.selection?.batchCode).toBe("PRST-001");
    expect(live.match?.status).toBe("ON_TRACK");
    session.dispose();
  });

  it("records direct serial samples and manual roast events", () => {
    const session = new RoastStudioSession();
    session.configureSelection({
      batchId: "batch-1",
      batchCode: "PRST-001",
      inputProductName: "Gayo Natural",
      targetWeightGrams: 5000,
      referenceProfile: {
        id: "reference-1",
        title: "Gayo Medium",
        machineId: "machine-1",
        durationSeconds: 600,
        greenWeightGrams: 5000,
        points: [],
        events: [],
      },
    });
    const started = session.startDirect({ title: "PRST-001", greenWeightGrams: 5000 });
    const at = new Date(started.startedAt!).getTime() / 1000;
    session.ingestDirect({ bt: 30, et: 184, heater: 80, fan: 20, at });
    session.ingestDirect({ bt: 35, et: 187, heater: 70, fan: 30, at: at + 10 });
    session.markEvent("TP");
    const finished = session.finishDirect(4250);

    expect(finished.source).toBe("DIRECT");
    expect(finished.points[1].ror).toBe(30);
    expect(finished.points[1]).toEqual(expect.objectContaining({ heater: 70, fan: 30 }));
    expect(finished.events.map((event) => event.type)).toEqual(["CHARGE", "TP", "DROP"]);
    expect(finished.roastedWeightGrams).toBe(4250);
    expect(finished.status).toBe("FINISHED");
    session.dispose();
  });

  it("restores an unfinished direct roast without losing its batch context", () => {
    const first = new RoastStudioSession();
    first.configureSelection({
      batchId: "batch-recovery",
      batchCode: "PRST-RECOVERY",
      inputProductName: "Gayo Natural",
      targetWeightGrams: 5000,
      referenceProfile: {
        id: "reference-recovery",
        title: "Recovery target",
        machineId: "machine-1",
        durationSeconds: 600,
        greenWeightGrams: 5000,
        points: [],
        events: [],
      },
    });
    const started = first.startDirect({ title: "PRST-RECOVERY", greenWeightGrams: 5000 });
    const at = new Date(started.startedAt!).getTime() / 1000;
    const checkpoint = first.ingestDirect({ bt: 31, et: 185, at });

    const restored = new RoastStudioSession();
    restored.restore(checkpoint);
    const resumed = restored.ingestDirect({ bt: 40, et: 190, at: at + 20 });

    expect(resumed.sessionId).toBe(checkpoint.sessionId);
    expect(resumed.selection?.batchId).toBe("batch-recovery");
    expect(resumed.points).toHaveLength(2);
    expect(resumed.elapsedSeconds).toBe(20);
    first.dispose();
    restored.dispose();
  });
});
