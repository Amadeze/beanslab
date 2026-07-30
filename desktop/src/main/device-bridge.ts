import { app } from "electron";
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import * as crypto from "crypto";
import type {
  DeviceBridgeConfig,
  DeviceBridgeSample,
  DeviceBridgeState,
  DetectedMachineDevice,
} from "../shared/types";
import { calibrateDeviceSample } from "../shared/device-calibration";
import { DeviceStreamHealth } from "../shared/device-stream-health";

type PendingCommand = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

const EMPTY_STATE: DeviceBridgeState = {
  status: "DISCONNECTED",
  port: null,
  adapter: null,
  latestSample: null,
  error: null,
};

export class DeviceBridge {
  private process: ChildProcessWithoutNullStreams | null = null;
  private pending = new Map<string, PendingCommand>();
  private state: DeviceBridgeState = { ...EMPTY_STATE };
  private stateListeners = new Set<(state: DeviceBridgeState) => void>();
  private sampleListeners = new Set<(sample: DeviceBridgeSample) => void>();
  private config: DeviceBridgeConfig | null = null;
  private health = new DeviceStreamHealth();

  getState(): DeviceBridgeState {
    return { ...this.state, latestSample: this.state.latestSample ? { ...this.state.latestSample } : null };
  }

  onState(listener: (state: DeviceBridgeState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  onSample(listener: (sample: DeviceBridgeSample) => void): () => void {
    this.sampleListeners.add(listener);
    return () => this.sampleListeners.delete(listener);
  }

  async connect(config: DeviceBridgeConfig): Promise<DeviceBridgeState> {
    await this.ensureStarted();
    await this.command("connect", config, 7000);
    this.config = { ...config };
    this.health.reset();
    return this.getState();
  }

  async discover(): Promise<DetectedMachineDevice[]> {
    await this.ensureStarted();
    return await this.command<DetectedMachineDevice[]>("discover", {}, 8000);
  }

  async test(): Promise<DeviceBridgeSample> {
    await this.ensureStarted();
    return await this.command<DeviceBridgeSample>("test", {}, 5000);
  }

  async start(): Promise<void> {
    await this.ensureStarted();
    await this.command("start");
  }

  async stop(): Promise<void> {
    if (!this.process) return;
    await this.command("stop");
  }

  async disconnect(): Promise<DeviceBridgeState> {
    if (this.process) await this.command("disconnect");
    this.config = null;
    this.health.reset();
    this.setState({ ...EMPTY_STATE });
    return this.getState();
  }

  dispose(): void {
    if (this.process) {
      this.process.stdin.write(`${JSON.stringify({ id: crypto.randomUUID(), command: "shutdown" })}\n`);
      this.process.kill();
    }
    this.process = null;
    this.config = null;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Device bridge dihentikan."));
    }
    this.pending.clear();
  }

  private async ensureStarted(): Promise<void> {
    if (this.process && !this.process.killed) return;
    const launch = this.resolveLaunch();
    const child = spawn(launch.executable, launch.args, {
      cwd: launch.cwd,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.process = child;
    const lines = readline.createInterface({ input: child.stdout });
    lines.on("line", (line) => this.handleLine(line));
    child.stderr.on("data", (chunk) => {
      const message = String(chunk).trim();
      if (message) this.setState({ ...this.state, error: message });
    });
    child.on("error", (error) => this.handleExit(error.message));
    child.on("exit", (code) => this.handleExit(`Device bridge berhenti (${code ?? "unknown"}).`));
    await this.command("hello", {}, 5000);
  }

  private resolveLaunch(): { executable: string; args: string[]; cwd: string } {
    const packaged = path.join(process.resourcesPath, "device-bridge", "RoastdDeviceBridge.exe");
    const explicit = process.env.ROASTD_DEVICE_BRIDGE_PATH;
    if (explicit && fs.existsSync(explicit)) return { executable: explicit, args: [], cwd: path.dirname(explicit) };
    if (app.isPackaged && fs.existsSync(packaged)) return { executable: packaged, args: [], cwd: path.dirname(packaged) };

    const repositoryRoot = path.resolve(__dirname, "../../..");
    const python = path.join(repositoryRoot, "roastd-studio-gpl", ".venv", "Scripts", "python.exe");
    const script = path.join(repositoryRoot, "roastd-studio-gpl", "src", "artisanlib", "roastd_device_bridge.py");
    if (!fs.existsSync(python) || !fs.existsSync(script)) {
      throw new Error("Driver mesin Roastd belum terpasang. Jalankan build device bridge.");
    }
    return { executable: python, args: [script], cwd: path.dirname(script) };
  }

  private command<T = unknown>(command: string, data: unknown = {}, timeoutMs = 5000): Promise<T> {
    if (!this.process?.stdin.writable) return Promise.reject(new Error("Device bridge tidak tersedia."));
    const id = crypto.randomUUID();
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Perangkat tidak merespons perintah ${command}.`));
      }, timeoutMs);
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timeout });
      this.process!.stdin.write(`${JSON.stringify({ id, command, data })}\n`);
    });
  }

  private handleLine(line: string): void {
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(line) as Record<string, unknown>;
    } catch {
      return;
    }
    if (typeof message.id === "string") {
      const pending = this.pending.get(message.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pending.delete(message.id);
        if (message.ok) pending.resolve(message.result);
        else pending.reject(new Error(String(message.error || "Perintah driver gagal.")));
      }
      return;
    }
    if (message.event === "status") {
      this.setState({
        ...this.state,
        status: message.status as DeviceBridgeState["status"],
        port: typeof message.port === "string" ? message.port : this.state.port,
        adapter: typeof message.adapter === "string" ? message.adapter as DeviceBridgeState["adapter"] : this.state.adapter,
        error: null,
      });
    } else if (message.event === "sample") {
      const rawSample: DeviceBridgeSample = {
        bt: typeof message.bt === "number" ? message.bt : null,
        et: typeof message.et === "number" ? message.et : null,
        at: typeof message.at === "number" ? message.at : Date.now() / 1000,
        heater: typeof message.heater === "number" ? message.heater : null,
        fan: typeof message.fan === "number" ? message.fan : null,
        drum: typeof message.drum === "number" ? message.drum : null,
        pressure: typeof message.pressure === "number" ? message.pressure : null,
        machineState: typeof message.machineState === "string" || typeof message.machineState === "number"
          ? message.machineState
          : null,
      };
      const sample = calibrateDeviceSample(rawSample, this.config);
      const health = this.health.recordSample(Date.now(), this.config?.intervalMs ?? 1_000);
      this.setState({ ...this.state, latestSample: sample, error: null, ...health });
      for (const listener of this.sampleListeners) listener({ ...sample });
    } else if (message.event === "error") {
      this.setState({ ...this.state, error: String(message.message || "Pembacaan sensor gagal.") });
    }
  }

  private handleExit(message: string): void {
    this.process = null;
    this.config = null;
    this.setState({ ...EMPTY_STATE, status: "ERROR", error: message });
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(message));
    }
    this.pending.clear();
  }

  private setState(state: DeviceBridgeState): void {
    this.state = state;
    const snapshot = this.getState();
    for (const listener of this.stateListeners) listener(snapshot);
  }
}
