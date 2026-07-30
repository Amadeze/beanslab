import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { StudioCheckpointStore } from "../main/studio-checkpoint";
import type { RoastStudioState } from "../shared/types";

const temporaryDirectories: string[] = [];

function checkpointState(): RoastStudioState {
  return {
    status: "RECORDING",
    source: "DIRECT",
    sessionId: "direct-1",
    title: "PRST-001",
    greenWeightGrams: 5000,
    roastedWeightGrams: null,
    startedAt: "2026-07-29T00:00:00.000Z",
    elapsedSeconds: 10,
    points: [{ second: 10, bt: 40, et: 190, ror: null, heater: 80 }],
    events: [{ type: "CHARGE", second: 0, bt: 30 }],
    selection: {
      batchId: "batch-1",
      batchCode: "PRST-001",
      inputProductName: "Gayo Natural",
      targetWeightGrams: 5000,
      referenceProfile: {
        id: "reference-1",
        title: "Target",
        machineId: "machine-1",
        durationSeconds: 600,
        greenWeightGrams: 5000,
        points: [],
        events: [],
      },
    },
    match: null,
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("StudioCheckpointStore", () => {
  it("atomically saves and loads an active roast", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "roastd-checkpoint-"));
    temporaryDirectories.push(directory);
    const store = new StudioCheckpointStore(directory);
    const state = checkpointState();

    store.save(state);

    expect(store.load()).toEqual(state);
    expect(fs.existsSync(path.join(directory, "active-roast.json.tmp"))).toBe(false);
  });

  it("ignores corrupt checkpoints and clears recovery files", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "roastd-checkpoint-"));
    temporaryDirectories.push(directory);
    fs.writeFileSync(path.join(directory, "active-roast.json"), "not-json");
    const store = new StudioCheckpointStore(directory);

    expect(store.load()).toBeNull();
    store.clear();
    expect(fs.existsSync(path.join(directory, "active-roast.json"))).toBe(false);
  });
});
