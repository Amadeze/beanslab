import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { app } from "electron";
import type { RoastStudioEventType, RoastStudioPoint, RoastStudioState } from "../shared/types";

type PythonValue = null | boolean | number | string | PythonValue[] | { [key: string]: PythonValue };

const EVENT_INDEX: Partial<Record<RoastStudioEventType, number>> = {
  CHARGE: 0,
  DRY_END: 1,
  FCs: 2,
  FCe: 3,
  SCs: 4,
  DROP: 6,
};

function pythonLiteral(value: PythonValue): string {
  if (value === null) return "None";
  if (value === true) return "True";
  if (value === false) return "False";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "None";
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(pythonLiteral).join(", ")}]`;
  return `{${Object.entries(value)
    .map(([key, item]) => `${JSON.stringify(key)}: ${pythonLiteral(item)}`)
    .join(", ")}}`;
}

function nearestPointIndex(points: RoastStudioPoint[], second: number): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  points.forEach((point, index) => {
    const distance = Math.abs(point.second - second);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function eventDetails(state: RoastStudioState, type: RoastStudioEventType) {
  const event = state.events.find((item) => item.type === type);
  if (!event) return null;
  const point = state.points[nearestPointIndex(state.points, event.second)];
  return { second: event.second, bt: event.bt ?? point?.bt ?? null, et: point?.et ?? null };
}

function safeFilename(value: string): string {
  const clean = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._ -]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return clean || "roast-profile";
}

function localDateLabel(date: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[date.getDay()]} ${months[date.getMonth()]} ${date.getDate()} ${date.getFullYear()}`;
}

export function buildAlogProfile(state: RoastStudioState, appVersion: string): Record<string, PythonValue> {
  if (state.status !== "FINISHED") throw new Error("Roast harus selesai sebelum disimpan sebagai .alog.");
  if (state.points.length === 0) throw new Error("Roast belum memiliki data temperatur.");

  const startedAt = new Date(state.startedAt ?? Date.now());
  const validStartedAt = Number.isNaN(startedAt.getTime()) ? new Date() : startedAt;
  const first = state.points[0];
  // Artisan reserves index 0 as "event not set". A pre-charge sample keeps CHARGE at index 1.
  const points: RoastStudioPoint[] = [
    { ...first, second: Math.min(-1, first.second - 1) },
    ...state.points,
  ];
  const timeindex = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const event of state.events) {
    const target = EVENT_INDEX[event.type];
    if (target == null) continue;
    timeindex[target] = nearestPointIndex(points, event.second);
  }

  const charge = eventDetails(state, "CHARGE") ?? { second: 0, bt: first.bt, et: first.et };
  const turning = eventDetails(state, "TP");
  const dry = eventDetails(state, "DRY_END");
  const fcs = eventDetails(state, "FCs");
  const fce = eventDetails(state, "FCe");
  const scs = eventDetails(state, "SCs");
  const drop = eventDetails(state, "DROP") ?? {
    second: state.elapsedSeconds,
    bt: state.points.at(-1)?.bt ?? null,
    et: state.points.at(-1)?.et ?? null,
  };
  const inputWeight = state.greenWeightGrams ?? 0;
  const outputWeight = state.roastedWeightGrams ?? 0;
  const weightLoss = inputWeight > 0 && outputWeight > 0
    ? Math.round(((inputWeight - outputWeight) / inputWeight) * 10_000) / 100
    : 0;

  const computed: Record<string, PythonValue> = {
    CHARGE_time: charge.second,
    CHARGE_BT: charge.bt,
    CHARGE_ET: charge.et,
    TP_idx: turning ? nearestPointIndex(points, turning.second) : null,
    TP_time: turning?.second ?? null,
    TP_BT: turning?.bt ?? null,
    TP_ET: turning?.et ?? null,
    DRY_time: dry?.second ?? null,
    DRY_BT: dry?.bt ?? null,
    DRY_ET: dry?.et ?? null,
    FCs_time: fcs?.second ?? null,
    FCs_BT: fcs?.bt ?? null,
    FCs_ET: fcs?.et ?? null,
    FCe_time: fce?.second ?? null,
    SCs_time: scs?.second ?? null,
    DROP_time: drop.second,
    DROP_BT: drop.bt,
    DROP_ET: drop.et,
    totaltime: Math.max(0, drop.second - charge.second),
    weightin: inputWeight,
    weightout: outputWeight,
    weight_loss: weightLoss,
  };

  return {
    recording_version: "4.0.2",
    recording_revision: "",
    recording_build: "0",
    version: "4.0.2",
    revision: "",
    build: "0",
    roastd_studio_version: appVersion,
    roastd_context: state.selection ? {
      parentBatchId: state.selection.batchId,
      parentBatchCode: state.selection.batchCode,
      referenceRoastId: state.selection.referenceProfile.id,
      matchAlgorithmVersion: state.match?.algorithmVersion ?? "roastd-v1",
      previewMatchScore: state.match?.score ?? null,
      previewMatchStatus: state.match?.status ?? null,
    } : null,
    roastd_actuators: {
      heater: state.points.map((point) => point.heater ?? null),
      fan: state.points.map((point) => point.fan ?? null),
      drum: state.points.map((point) => point.drum ?? null),
      pressure: state.points.map((point) => point.pressure ?? null),
      machineState: state.points.map((point) => point.machineState ?? null),
    },
    artisan_os: "Windows",
    artisan_os_version: os.release(),
    artisan_os_arch: os.arch(),
    mode: "C",
    viewerMode: false,
    title: state.title,
    locale: "id_ID",
    beans: state.title,
    weight: [inputWeight, outputWeight, "g"],
    volume: [0, 0, "l"],
    density: [0, "g", 1, "l"],
    density_roasted: [0, "g", 1, "l"],
    roastertype: "Roastd Studio",
    roastersize: 0,
    machinesetup: "",
    operator: "",
    organization: "",
    roastdate: localDateLabel(validStartedAt),
    roastisodate: validStartedAt.toISOString().slice(0, 10),
    roasttime: validStartedAt.toTimeString().slice(0, 8),
    roastepoch: Math.floor(validStartedAt.getTime() / 1000),
    roasttzoffset: -validStartedAt.getTimezoneOffset() * 60,
    roastbatchnr: 0,
    roastbatchprefix: "",
    roastbatchpos: 1,
    roastUUID: crypto.randomUUID().replaceAll("-", ""),
    roastingnotes: "Generated by Roastd Studio",
    cuppingnotes: "",
    timex: points.map((point) => point.second),
    // Artisan convention: temp1 = ET and temp2 = BT.
    temp1: points.map((point) => point.et ?? -1),
    temp2: points.map((point) => point.bt ?? -1),
    timeindex,
    phases: [150, 180, 195, 205],
    samplinginterval: 1,
    specialevents: [],
    specialeventstype: [],
    specialeventsvalue: [],
    specialeventsStrings: [],
    default_etypes: [true, true, true, true, true],
    etypes: ["Air", "Drum", "Damper", "Burner", "--"],
    extradevices: [],
    extraname1: [],
    extraname2: [],
    extratimex: [],
    extratemp1: [],
    extratemp2: [],
    alarmflag: [],
    alarmguard: [],
    alarmnegguard: [],
    alarmtime: [],
    alarmoffset: [],
    alarmcond: [],
    alarmsource: [],
    alarmtemperature: [],
    alarmaction: [],
    alarmbeep: [],
    alarmstrings: [],
    devices: ["NONE"],
    ambientTemp: 0,
    ambient_humidity: 0,
    ambient_pressure: 0,
    computed,
    anno_positions: [],
    flag_positions: [],
  };
}

export function serializeAlog(state: RoastStudioState, appVersion: string): string {
  return pythonLiteral(buildAlogProfile(state, appVersion) as PythonValue);
}

export function getDefaultProfileDirectory(): string {
  return path.join(app.getPath("documents"), "Roastd Studio", "profiles");
}

export function writeAlogProfile(
  state: RoastStudioState,
  appVersion: string,
  outputDirectory = getDefaultProfileDirectory(),
): string {
  fs.mkdirSync(outputDirectory, { recursive: true });
  const startedAt = new Date(state.startedAt ?? Date.now());
  const stamp = (Number.isNaN(startedAt.getTime()) ? new Date() : startedAt)
    .toISOString()
    .replace(/[:.]/g, "-");
  const filePath = path.join(outputDirectory, `${safeFilename(state.title)}-${stamp}.alog`);
  fs.writeFileSync(filePath, serializeAlog(state, appVersion), "utf8");
  return filePath;
}
