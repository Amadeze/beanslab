import type {
  RoastStudioEventType,
  RoastStudioPoint,
  StudioRoastSelection,
  RoastStudioState,
  StartSimulatorRequest,
  DeviceBridgeSample,
} from "../shared/types";
import type { MqttLivePayload } from "./mqtt-client";
import { matchRoastProfile } from "./profile-matcher";

type StateListener = (state: RoastStudioState) => void;

const EMPTY_STATE: RoastStudioState = {
  status: "IDLE",
  source: null,
  sessionId: null,
  title: "",
  greenWeightGrams: null,
  roastedWeightGrams: null,
  startedAt: null,
  elapsedSeconds: 0,
  points: [],
  events: [],
  selection: null,
  match: null,
};

const EVENT_TYPES = new Set<RoastStudioEventType>([
  "CHARGE",
  "TP",
  "DRY_END",
  "FCs",
  "FCe",
  "SCs",
  "DROP",
]);

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function createSimulatorPoint(second: number): RoastStudioPoint {
  const minute = second / 60;
  const bt = 30 + 13 * minute + 60 * (1 - Math.exp(-minute / 2.8));
  const et = 184 + 4.1 * minute + Math.sin(minute * 0.8) * 3;
  const previousMinute = Math.max(0, second - 5) / 60;
  const previousBt = 30 + 13 * previousMinute + 60 * (1 - Math.exp(-previousMinute / 2.8));
  const ror = second < 5 ? null : (bt - previousBt) * 12;

  return {
    second,
    bt: round(bt),
    et: round(et),
    ror: ror == null ? null : round(ror),
  };
}

function cloneState(state: RoastStudioState): RoastStudioState {
  return {
    ...state,
    points: state.points.map((point) => ({ ...point })),
    events: state.events.map((event) => ({ ...event })),
    selection: state.selection ? {
      ...state.selection,
      referenceProfile: {
        ...state.selection.referenceProfile,
        points: state.selection.referenceProfile.points.map((point) => ({ ...point })),
        events: state.selection.referenceProfile.events.map((event) => ({ ...event })),
      },
    } : null,
    match: state.match ? {
      ...state.match,
      eventDeltas: state.match.eventDeltas.map((event) => ({ ...event })),
    } : null,
  };
}

export class RoastStudioSession {
  private state: RoastStudioState = cloneState(EMPTY_STATE);
  private listeners = new Set<StateListener>();
  private simulatorTimer: NodeJS.Timeout | null = null;
  private liveStartedAtMs: number | null = null;
  private selection: StudioRoastSelection | null = null;

  getState(): RoastStudioState {
    return cloneState(this.state);
  }

  onChange(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  restore(state: RoastStudioState): RoastStudioState {
    if (state.status !== "RECORDING" || state.source !== "DIRECT" || !state.selection) {
      throw new Error("Checkpoint roast tidak dapat dipulihkan.");
    }
    const startedAtMs = new Date(state.startedAt ?? "").getTime();
    if (!Number.isFinite(startedAtMs)) throw new Error("Waktu checkpoint roast tidak valid.");

    this.stopTimer();
    this.selection = state.selection;
    this.liveStartedAtMs = startedAtMs;
    this.state = cloneState(state);
    this.updateMatch();
    this.emit();
    return this.getState();
  }

  configureSelection(selection: StudioRoastSelection | null): RoastStudioState {
    if (this.state.status === "RECORDING") {
      throw new Error("Profil acuan tidak dapat diganti saat roasting berjalan.");
    }
    this.selection = selection;
    this.state.selection = selection;
    this.state.match = null;
    this.emit();
    return this.getState();
  }

  startSimulator(input: StartSimulatorRequest): RoastStudioState {
    const title = input.title.trim();
    if (!title) throw new Error("Nama roast wajib diisi.");
    if (!Number.isFinite(input.greenWeightGrams) || input.greenWeightGrams <= 0) {
      throw new Error("Berat green bean harus lebih dari 0 gram.");
    }

    this.stopTimer();
    const startedAt = new Date();
    this.state = {
      status: "RECORDING",
      source: "SIMULATOR",
      sessionId: `sim-${startedAt.getTime()}`,
      title,
      greenWeightGrams: input.greenWeightGrams,
      roastedWeightGrams: null,
      startedAt: startedAt.toISOString(),
      elapsedSeconds: 0,
      points: [createSimulatorPoint(0)],
      events: [{ type: "CHARGE", second: 0, bt: 30 }],
      selection: this.selection,
      match: null,
    };
    this.updateMatch();
    this.emit();

    this.simulatorTimer = setInterval(() => {
      const nextSecond = this.state.elapsedSeconds + 1;
      this.state.elapsedSeconds = nextSecond;
      this.appendPoint(createSimulatorPoint(nextSecond));
      this.updateMatch();
      this.emit();
    }, 1000);

    return this.getState();
  }

  startDirect(input: StartSimulatorRequest): RoastStudioState {
    const title = input.title.trim();
    if (!title) throw new Error("Nama roast wajib diisi.");
    if (!Number.isFinite(input.greenWeightGrams) || input.greenWeightGrams <= 0) {
      throw new Error("Berat green bean harus lebih dari 0 gram.");
    }
    if (!this.selection) throw new Error("Pilih Parent Batch dan profil acuan terlebih dahulu.");

    this.stopTimer();
    const startedAt = new Date();
    this.liveStartedAtMs = startedAt.getTime();
    this.state = {
      status: "RECORDING",
      source: "DIRECT",
      sessionId: `direct-${startedAt.getTime()}`,
      title,
      greenWeightGrams: input.greenWeightGrams,
      roastedWeightGrams: null,
      startedAt: startedAt.toISOString(),
      elapsedSeconds: 0,
      points: [],
      events: [{ type: "CHARGE", second: 0, bt: null }],
      selection: this.selection,
      match: null,
    };
    this.updateMatch();
    this.emit();
    return this.getState();
  }

  ingestDirect(sample: DeviceBridgeSample): RoastStudioState {
    if (this.state.status !== "RECORDING" || this.state.source !== "DIRECT") return this.getState();
    const atMs = Number.isFinite(sample.at) ? sample.at * 1000 : Date.now();
    const second = Math.max(0, Math.round((atMs - (this.liveStartedAtMs ?? atMs)) / 1000));
    const previous = this.state.points.at(-1);
    const deltaSeconds = previous ? Math.max(1, second - previous.second) : 0;
    const ror = previous?.bt != null && sample.bt != null && deltaSeconds > 0
      ? round(((sample.bt - previous.bt) / deltaSeconds) * 60)
      : null;
    this.state.elapsedSeconds = Math.max(this.state.elapsedSeconds, second);
    this.appendPoint({
      second,
      bt: sample.bt,
      et: sample.et,
      ror,
      heater: sample.heater ?? null,
      fan: sample.fan ?? null,
      drum: sample.drum ?? null,
      pressure: sample.pressure ?? null,
      machineState: sample.machineState ?? null,
    });
    if (this.state.events[0]?.type === "CHARGE" && this.state.events[0].bt == null) {
      this.state.events[0].bt = sample.bt;
    }
    this.updateMatch();
    this.emit();
    return this.getState();
  }

  markEvent(type: RoastStudioEventType): RoastStudioState {
    if (this.state.status !== "RECORDING") throw new Error("Belum ada roast yang berjalan.");
    if (this.state.source === "MQTT") throw new Error("Event dari koneksi MQTT dibaca otomatis dari mesin.");
    if (!EVENT_TYPES.has(type) || type === "CHARGE" || type === "DROP") {
      throw new Error("Event tidak dapat ditandai manual.");
    }
    if (this.state.events.some((event) => event.type === type)) return this.getState();

    const latest = this.state.points.at(-1);
    this.state.events.push({ type, second: this.state.elapsedSeconds, bt: latest?.bt ?? null });
    this.updateMatch();
    this.emit();
    return this.getState();
  }

  finishSimulator(): RoastStudioState {
    if (this.state.status !== "RECORDING" || this.state.source !== "SIMULATOR") {
      throw new Error("Simulator belum berjalan.");
    }
    const latest = this.state.points.at(-1);
    this.state.events.push({ type: "DROP", second: this.state.elapsedSeconds, bt: latest?.bt ?? null });
    this.state.status = "FINISHED";
    this.updateMatch(true);
    this.stopTimer();
    this.emit();
    return this.getState();
  }

  finishDirect(roastedWeightGrams: number): RoastStudioState {
    if (this.state.status !== "RECORDING" || this.state.source !== "DIRECT") {
      throw new Error("Roast dari mesin belum berjalan.");
    }
    if (!Number.isFinite(roastedWeightGrams) || roastedWeightGrams <= 0) {
      throw new Error("Berat hasil roasting harus lebih dari 0 gram.");
    }
    if (this.state.greenWeightGrams && roastedWeightGrams >= this.state.greenWeightGrams) {
      throw new Error("Berat hasil harus lebih kecil dari green bean yang dimasukkan.");
    }
    const latest = this.state.points.at(-1);
    this.state.events.push({ type: "DROP", second: this.state.elapsedSeconds, bt: latest?.bt ?? null });
    this.state.roastedWeightGrams = Math.round(roastedWeightGrams);
    this.state.status = "FINISHED";
    this.updateMatch(true);
    this.emit();
    return this.getState();
  }

  ingestMqtt(payload: MqttLivePayload): RoastStudioState {
    const sourceAt = payload.data.timestamp ? new Date(payload.data.timestamp) : new Date();
    const sourceAtMs = Number.isNaN(sourceAt.getTime()) ? Date.now() : sourceAt.getTime();

    if (this.state.source !== "MQTT" || this.state.status === "FINISHED") {
      this.stopTimer();
      this.liveStartedAtMs = sourceAtMs;
      this.state = {
        status: "RECORDING",
        source: "MQTT",
        sessionId: `live-${sourceAtMs}`,
        title: "Roast live dari Artisan",
        greenWeightGrams: null,
        roastedWeightGrams: null,
        startedAt: new Date(sourceAtMs).toISOString(),
        elapsedSeconds: 0,
        points: [],
        events: [],
        selection: this.selection,
        match: null,
      };
    }

    const second = Math.max(0, Math.round((sourceAtMs - (this.liveStartedAtMs ?? sourceAtMs)) / 1000));
    this.state.elapsedSeconds = Math.max(this.state.elapsedSeconds, second);

    const bt = typeof payload.data.BT === "number" ? payload.data.BT : null;
    const et = typeof payload.data.ET === "number" ? payload.data.ET : null;
    if (bt != null || et != null) {
      const previous = this.state.points.at(-1);
      const deltaSeconds = previous ? Math.max(1, second - previous.second) : 0;
      const ror = previous?.bt != null && bt != null && deltaSeconds > 0
        ? round(((bt - previous.bt) / deltaSeconds) * 60)
        : null;
      this.appendPoint({ second, bt, et, ror });
    }

    const normalizedEvent = payload.eventType === "DRY" ? "DRY_END" : payload.eventType;
    if (EVENT_TYPES.has(normalizedEvent as RoastStudioEventType)) {
      const type = normalizedEvent as RoastStudioEventType;
      if (!this.state.events.some((event) => event.type === type)) {
        this.state.events.push({ type, second, bt });
      }
      if (type === "DROP") this.state.status = "FINISHED";
    }

    this.updateMatch(this.state.status === "FINISHED");

    this.emit();
    return this.getState();
  }

  reset(): RoastStudioState {
    this.stopTimer();
    this.liveStartedAtMs = null;
    this.state = cloneState({ ...EMPTY_STATE, selection: this.selection });
    this.emit();
    return this.getState();
  }

  dispose(): void {
    this.stopTimer();
    this.listeners.clear();
  }

  private appendPoint(point: RoastStudioPoint): void {
    this.state.points.push(point);
    if (this.state.points.length > 1200) this.state.points = this.state.points.slice(-1200);
  }

  private stopTimer(): void {
    if (this.simulatorTimer) clearInterval(this.simulatorTimer);
    this.simulatorTimer = null;
  }

  private updateMatch(finished = false): void {
    this.state.match = matchRoastProfile(
      this.state.points,
      this.state.events,
      this.state.selection?.referenceProfile ?? null,
      finished,
    );
  }

  private emit(): void {
    const snapshot = this.getState();
    for (const listener of this.listeners) listener(snapshot);
  }
}
