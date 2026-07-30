import * as fs from "fs";
import * as path from "path";
import type { RoastStudioState } from "../shared/types";

const CHECKPOINT_FILE = "active-roast.json";

function isRecoverableState(value: unknown): value is RoastStudioState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<RoastStudioState>;
  return state.status === "RECORDING"
    && state.source === "DIRECT"
    && typeof state.sessionId === "string"
    && typeof state.title === "string"
    && typeof state.startedAt === "string"
    && Array.isArray(state.points)
    && Array.isArray(state.events)
    && Boolean(state.selection);
}

export class StudioCheckpointStore {
  private readonly filePath: string;
  private readonly temporaryPath: string;

  constructor(directory: string) {
    this.filePath = path.join(directory, CHECKPOINT_FILE);
    this.temporaryPath = `${this.filePath}.tmp`;
  }

  save(state: RoastStudioState): void {
    if (!isRecoverableState(state)) return;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.temporaryPath, JSON.stringify(state), { encoding: "utf8", mode: 0o600 });
    try {
      fs.renameSync(this.temporaryPath, this.filePath);
    } catch {
      fs.copyFileSync(this.temporaryPath, this.filePath);
      fs.rmSync(this.temporaryPath, { force: true });
    }
  }

  load(): RoastStudioState | null {
    try {
      if (!fs.existsSync(this.filePath)) return null;
      const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      return isRecoverableState(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  clear(): void {
    fs.rmSync(this.filePath, { force: true });
    fs.rmSync(this.temporaryPath, { force: true });
  }
}
