import type {
  RoastProfileMatch,
  RoastReferenceProfile,
  RoastStudioEvent,
  RoastStudioEventType,
  RoastStudioPoint,
} from "../shared/types";

const EVENT_TYPES: RoastStudioEventType[] = ["TP", "DRY_END", "FCs", "FCe", "SCs", "DROP"];

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function interpolate(
  points: RoastStudioPoint[],
  second: number,
  key: "bt" | "et" | "ror",
): number | null {
  const usable = points.filter((point) => point[key] != null);
  if (usable.length === 0 || second < usable[0].second || second > usable.at(-1)!.second) return null;

  let low = 0;
  let high = usable.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const point = usable[middle];
    if (point.second === second) return point[key];
    if (point.second < second) low = middle + 1;
    else high = middle - 1;
  }

  const before = usable[Math.max(0, high)];
  const after = usable[Math.min(usable.length - 1, low)];
  if (before.second === after.second) return before[key];
  const ratio = (second - before.second) / (after.second - before.second);
  return (before[key] as number) + ((after[key] as number) - (before[key] as number)) * ratio;
}

function rmse(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.sqrt(values.reduce((sum, value) => sum + value ** 2, 0) / values.length);
}

function chargeSecond(events: RoastStudioEvent[]): number {
  return events.find((event) => event.type === "CHARGE")?.second ?? 0;
}

function eventDeltas(actual: RoastStudioEvent[], target: RoastStudioEvent[]) {
  const actualCharge = chargeSecond(actual);
  const targetCharge = chargeSecond(target);
  return EVENT_TYPES.flatMap((type) => {
    const actualEvent = actual.find((event) => event.type === type);
    const targetEvent = target.find((event) => event.type === type);
    if (!actualEvent || !targetEvent) return [];
    return [{
      type,
      actualSecond: actualEvent.second - actualCharge,
      targetSecond: targetEvent.second - targetCharge,
      deltaSeconds: (actualEvent.second - actualCharge) - (targetEvent.second - targetCharge),
    }];
  });
}

function statusFor(latestBtDelta: number | null, latestRorDelta: number | null, score: number | null) {
  const bt = Math.abs(latestBtDelta ?? 0);
  const ror = Math.abs(latestRorDelta ?? 0);
  if (bt > 6 || ror > 5 || (score != null && score < 70)) return "DIVERGED" as const;
  if (bt > 3 || ror > 3 || (score != null && score < 85)) return "WATCH" as const;
  return "ON_TRACK" as const;
}

function assistMessage(
  status: "ON_TRACK" | "WATCH" | "DIVERGED",
  latestBtDelta: number | null,
  latestRorDelta: number | null,
): string {
  if (status === "ON_TRACK") return "Sesuai acuan. Tahan pola saat ini.";
  if (latestBtDelta == null || latestRorDelta == null) {
    return status === "WATCH"
      ? "Ada deviasi kecil. Pantau RoR dan timing event."
      : "Kurva menjauh dari acuan. Evaluasi energi sesuai SOP mesin.";
  }
  if (latestBtDelta < 0 && latestRorDelta < 0) {
    return "Kurva tertinggal. Evaluasi tambahan energi sesuai SOP mesin.";
  }
  if (latestBtDelta > 0 && latestRorDelta > 0) {
    return "Kurva terlalu cepat. Evaluasi pengurangan energi atau airflow sesuai SOP.";
  }
  if (latestBtDelta > 0 && latestRorDelta < 0) {
    return "Suhu di atas acuan namun melandai. Hindari koreksi berlebihan.";
  }
  return "Kurva sedang mengejar acuan. Tahan perubahan besar.";
}

export function deriveProfileRor(points: RoastStudioPoint[]): RoastStudioPoint[] {
  return points.map((point, index) => {
    if (point.ror != null || point.bt == null) return { ...point };
    const previous = [...points.slice(0, index)].reverse().find((candidate) => candidate.bt != null && candidate.second < point.second);
    if (previous?.bt == null) return { ...point, ror: null };
    const deltaSeconds = point.second - previous.second;
    return {
      ...point,
      ror: deltaSeconds > 0 ? round(((point.bt - previous.bt) / deltaSeconds) * 60) : null,
    };
  });
}

export function matchRoastProfile(
  actualPoints: RoastStudioPoint[],
  actualEvents: RoastStudioEvent[],
  reference: RoastReferenceProfile | null,
  finished = false,
): RoastProfileMatch | null {
  if (!reference) return null;
  if (reference.points.length < 2) {
    return {
      algorithmVersion: "roastd-v1",
      status: "INVALID",
      score: null,
      coveragePercent: 0,
      btRmse: null,
      rorRmse: null,
      durationDeltaSeconds: null,
      latestBtDelta: null,
      latestRorDelta: null,
      eventDeltas: [],
      message: "Profil acuan belum memiliki kurva yang cukup.",
    };
  }

  const targetPoints = deriveProfileRor(reference.points);
  const actualCharge = chargeSecond(actualEvents);
  const targetCharge = chargeSecond(reference.events);
  const btErrors: number[] = [];
  const rorErrors: number[] = [];
  let comparablePoints = 0;

  for (const point of actualPoints) {
    const alignedSecond = point.second - actualCharge;
    if (alignedSecond < 0) continue;
    const targetSecond = alignedSecond + targetCharge;
    const targetBt = interpolate(targetPoints, targetSecond, "bt");
    const targetRor = interpolate(targetPoints, targetSecond, "ror");
    if (point.bt != null && targetBt != null) {
      btErrors.push(point.bt - targetBt);
      comparablePoints += 1;
    }
    if (point.ror != null && targetRor != null) rorErrors.push(point.ror - targetRor);
  }

  const latest = actualPoints.at(-1);
  const latestTargetSecond = latest ? latest.second - actualCharge + targetCharge : null;
  const latestTargetBt = latestTargetSecond != null ? interpolate(targetPoints, latestTargetSecond, "bt") : null;
  const latestTargetRor = latestTargetSecond != null ? interpolate(targetPoints, latestTargetSecond, "ror") : null;
  const latestBtDelta = latest?.bt != null && latestTargetBt != null ? round(latest.bt - latestTargetBt) : null;
  const latestRorDelta = latest?.ror != null && latestTargetRor != null ? round(latest.ror - latestTargetRor) : null;
  const btRmse = rmse(btErrors);
  const rorRmse = rmse(rorErrors);
  const deltas = eventDeltas(actualEvents, reference.events);
  const actualDrop = actualEvents.find((event) => event.type === "DROP")?.second;
  const targetDrop = reference.events.find((event) => event.type === "DROP")?.second;
  const actualDuration = actualDrop != null ? actualDrop - actualCharge : null;
  const targetDuration = targetDrop != null ? targetDrop - targetCharge : reference.durationSeconds;
  const durationDeltaSeconds = actualDuration != null && targetDuration != null ? actualDuration - targetDuration : null;

  const components: Array<{ weight: number; score: number | null }> = [
    { weight: 40, score: btRmse == null ? null : clampScore(100 - btRmse * 10) },
    { weight: 30, score: rorRmse == null ? null : clampScore(100 - rorRmse * 8) },
    {
      weight: 20,
      score: deltas.length === 0
        ? null
        : clampScore(100 - (deltas.reduce((sum, item) => sum + Math.abs(item.deltaSeconds), 0) / deltas.length) / 1.2),
    },
    { weight: 10, score: durationDeltaSeconds == null ? null : clampScore(100 - Math.abs(durationDeltaSeconds) / 1.2) },
  ];
  const available = components.filter((component) => component.score != null);
  const totalWeight = available.reduce((sum, component) => sum + component.weight, 0);
  const score = available.length === 0
    ? null
    : round(available.reduce((sum, component) => sum + (component.score as number) * component.weight, 0) / totalWeight, 0);
  const coveragePercent = actualPoints.length === 0 ? 0 : round((comparablePoints / actualPoints.length) * 100, 0);
  const status = statusFor(latestBtDelta, latestRorDelta, finished ? score : null);

  const message = assistMessage(status, latestBtDelta, latestRorDelta);

  return {
    algorithmVersion: "roastd-v1",
    status,
    score: finished ? score : null,
    coveragePercent,
    btRmse: btRmse == null ? null : round(btRmse),
    rorRmse: rorRmse == null ? null : round(rorRmse),
    durationDeltaSeconds,
    latestBtDelta,
    latestRorDelta,
    eventDeltas: deltas,
    message,
  };
}
