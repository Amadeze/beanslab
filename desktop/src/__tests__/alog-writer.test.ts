import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { buildAlogProfile, serializeAlog, writeAlogProfile } from "../main/alog-writer";
import type { RoastStudioState } from "../shared/types";

const temporaryDirectories: string[] = [];

function finishedRoast(): RoastStudioState {
  return {
    status: "FINISHED",
    source: "SIMULATOR",
    sessionId: "sim-1",
    title: "Gayo Natural Test",
    greenWeightGrams: 5000,
    roastedWeightGrams: 4250,
    startedAt: "2026-07-28T01:00:00.000Z",
    elapsedSeconds: 120,
    points: [
      { second: 0, bt: 30, et: 180, ror: null },
      { second: 60, bt: 110, et: 190, ror: 20, heater: 80, fan: 20 },
      { second: 120, bt: 205, et: 220, ror: 10, heater: 50, fan: 40 },
    ],
    events: [
      { type: "CHARGE", second: 0, bt: 30 },
      { type: "TP", second: 60, bt: 110 },
      { type: "DROP", second: 120, bt: 205 },
    ],
    selection: null,
    match: null,
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("Artisan-compatible .alog writer", () => {
  it("maps the roast curve and events to Artisan profile fields", () => {
    const profile = buildAlogProfile(finishedRoast(), "0.5.0");

    expect(profile.mode).toBe("C");
    expect(profile.timex).toEqual([-1, 0, 60, 120]);
    expect(profile.temp1).toEqual([180, 180, 190, 220]);
    expect(profile.temp2).toEqual([30, 30, 110, 205]);
    expect(profile.timeindex).toEqual([1, 0, 0, 0, 0, 0, 3, 0]);
    expect(profile.computed).toMatchObject({ CHARGE_time: 0, DROP_time: 120, TP_time: 60 });
    expect(profile.computed).toMatchObject({ weightin: 5000, weightout: 4250, weight_loss: 15 });
    expect(profile.weight).toEqual([5000, 4250, "g"]);
    expect(profile.roastd_actuators).toEqual({
      heater: [null, 80, 50],
      fan: [null, 20, 40],
      drum: [null, null, null],
      pressure: [null, null, null],
      machineState: [null, null, null],
    });
  });

  it("serializes Python booleans and a one-line dictionary", () => {
    const serialized = serializeAlog(finishedRoast(), "0.5.0");
    expect(serialized.startsWith("{")).toBe(true);
    expect(serialized).toContain('"viewerMode": False');
    expect(serialized).toContain('"roastd_studio_version": "0.5.0"');
    expect(serialized).not.toContain("\n");
  });

  it("writes a reusable .alog profile", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "roastd-alog-"));
    temporaryDirectories.push(directory);
    const filePath = writeAlogProfile(finishedRoast(), "0.5.0", directory);

    expect(path.extname(filePath)).toBe(".alog");
    expect(fs.statSync(filePath).size).toBeGreaterThan(500);
    expect(fs.readFileSync(filePath, "utf8")).toContain('"title": "Gayo Natural Test"');
  });

  it("embeds batch and reference identifiers for reliable offline reconciliation", () => {
    const state = finishedRoast();
    state.selection = {
      batchId: "batch-1",
      batchCode: "PRST-001",
      inputProductName: "Gayo Natural",
      targetWeightGrams: 5000,
      referenceProfile: {
        id: "reference-1",
        title: "Gayo Medium v2",
        machineId: "machine-1",
        durationSeconds: 120,
        greenWeightGrams: 5000,
        points: state.points,
        events: state.events,
      },
    };
    const serialized = serializeAlog(state, "0.5.0");

    expect(serialized).toContain('"parentBatchId": "batch-1"');
    expect(serialized).toContain('"referenceRoastId": "reference-1"');
  });
});
