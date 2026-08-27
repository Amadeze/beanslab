export type RoastMatchStatusValue = "ON_TRACK" | "WATCH" | "DIVERGED" | "INVALID";

export type TemperatureSeriesPoint = { second: number; value: number };
export type ProfileEvent = { second: number; type: string };

export type MatchableRoast = {
  duration: number | null;
  beanTemperatureSeries: unknown;
  events: unknown;
};

export type RoastMatchDetails = {
  algorithmVersion: "roastd-v1";
  status: RoastMatchStatusValue;
  score: number | null;
  coveragePercent: number;
  btRmse: number | null;
  rorRmse: number | null;
  durationDeltaSeconds: number | null;
  eventDeltas: Array<{
    type: string;
    actualSecond: number;
    targetSecond: number;
    deltaSeconds: number;
  }>;
};

const COMPARED_EVENTS = ["TP", "DRY_END", "FCs", "FCe", "SCs", "DROP"];

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function temperatureSeries(value: unknown): TemperatureSeriesPoint[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const second = Number((item as Record<string, unknown>).second);
      const pointValue = Number((item as Record<string, unknown>).value);
      return Number.isFinite(second) && Number.isFinite(pointValue) ? [{ second, value: pointValue }] : [];
    })
    .sort((a, b) => a.second - b.second);
}

function profileEvents(value: unknown): ProfileEvent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const second = Number((item as Record<string, unknown>).second);
    const type = String((item as Record<string, unknown>).type ?? "");
    return Number.isFinite(second) && type ? [{ second, type }] : [];
  });
}

function rorSeries(series: TemperatureSeriesPoint[]): TemperatureSeriesPoint[] {
  return series.flatMap((point, index) => {
    if (index === 0) return [];
    const previous = series[index - 1];
    const seconds = point.second - previous.second;
    if (seconds <= 0) return [];
    return [{ second: point.second, value: ((point.value - previous.value) / seconds) * 60 }];
  });
}

function interpolate(series: TemperatureSeriesPoint[], second: number): number | null {
  if (series.length === 0 || second < series[0].second || second > series.at(-1)!.second) return null;
  let low = 0;
  let high = series.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (series[middle].second === second) return series[middle].value;
    if (series[middle].second < second) low = middle + 1;
    else high = middle - 1;
  }
  const before = series[Math.max(0, high)];
  const after = series[Math.min(series.length - 1, low)];
  if (before.second === after.second) return before.value;
  return before.value + (after.value - before.value) * ((second - before.second) / (after.second - before.second));
}

function rmse(errors: number[]): number | null {
  if (errors.length === 0) return null;
  return Math.sqrt(errors.reduce((sum, value) => sum + value ** 2, 0) / errors.length);
}

export function calculateRoastProfileMatch(actual: MatchableRoast, target: MatchableRoast): RoastMatchDetails {
  const actualBt = temperatureSeries(actual.beanTemperatureSeries);
  const targetBt = temperatureSeries(target.beanTemperatureSeries);
  if (actualBt.length < 2 || targetBt.length < 2) {
    return {
      algorithmVersion: "roastd-v1",
      status: "INVALID",
      score: null,
      coveragePercent: 0,
      btRmse: null,
      rorRmse: null,
      durationDeltaSeconds: null,
      eventDeltas: [],
    };
  }

  const actualRor = rorSeries(actualBt);
  const targetRor = rorSeries(targetBt);
  const actualEvents = profileEvents(actual.events);
  const targetEvents = profileEvents(target.events);
  const actualCharge = actualEvents.find((event) => event.type === "CHARGE")?.second ?? 0;
  const targetCharge = targetEvents.find((event) => event.type === "CHARGE")?.second ?? 0;
  const btErrors: number[] = [];
  const rorErrors: number[] = [];
  let comparable = 0;

  for (const point of actualBt) {
    const alignedSecond = point.second - actualCharge;
    if (alignedSecond < 0) continue;
    const targetValue = interpolate(targetBt, alignedSecond + targetCharge);
    if (targetValue != null) {
      btErrors.push(point.value - targetValue);
      comparable += 1;
    }
  }
  for (const point of actualRor) {
    const alignedSecond = point.second - actualCharge;
    if (alignedSecond < 0) continue;
    const targetValue = interpolate(targetRor, alignedSecond + targetCharge);
    if (targetValue != null) rorErrors.push(point.value - targetValue);
  }

  const btRmse = rmse(btErrors);
  const rorRmse = rmse(rorErrors);
  const eventDeltas = COMPARED_EVENTS.flatMap((type) => {
    const actualEvent = actualEvents.find((event) => event.type === type);
    const targetEvent = targetEvents.find((event) => event.type === type);
    if (!actualEvent || !targetEvent) return [];
    return [{
      type,
      actualSecond: actualEvent.second - actualCharge,
      targetSecond: targetEvent.second - targetCharge,
      deltaSeconds: (actualEvent.second - actualCharge) - (targetEvent.second - targetCharge),
    }];
  });
  const actualDrop = actualEvents.find((event) => event.type === "DROP")?.second;
  const targetDrop = targetEvents.find((event) => event.type === "DROP")?.second;
  const actualDuration = actualDrop != null ? actualDrop - actualCharge : actual.duration;
  const targetDuration = targetDrop != null ? targetDrop - targetCharge : target.duration;
  const durationDeltaSeconds = actualDuration != null && targetDuration != null
    ? actualDuration - targetDuration
    : null;

  const components: Array<{ weight: number; score: number | null }> = [
    { weight: 40, score: btRmse == null ? null : clampScore(100 - btRmse * 10) },
    { weight: 30, score: rorRmse == null ? null : clampScore(100 - rorRmse * 8) },
    {
      weight: 20,
      score: eventDeltas.length === 0
        ? null
        : clampScore(100 - (eventDeltas.reduce((sum, item) => sum + Math.abs(item.deltaSeconds), 0) / eventDeltas.length) / 1.2),
    },
    { weight: 10, score: durationDeltaSeconds == null ? null : clampScore(100 - Math.abs(durationDeltaSeconds) / 1.2) },
  ];
  const available = components.filter((component) => component.score != null);
  const totalWeight = available.reduce((sum, component) => sum + component.weight, 0);
  const score = available.length === 0
    ? null
    : round(available.reduce((sum, component) => sum + (component.score as number) * component.weight, 0) / totalWeight, 0);
  const status: RoastMatchStatusValue = score == null
    ? "INVALID"
    : score >= 85
      ? "ON_TRACK"
      : score >= 70
        ? "WATCH"
        : "DIVERGED";

  return {
    algorithmVersion: "roastd-v1",
    status,
    score,
    coveragePercent: round((comparable / actualBt.length) * 100, 0),
    btRmse: btRmse == null ? null : round(btRmse),
    rorRmse: rorRmse == null ? null : round(rorRmse),
    durationDeltaSeconds,
    eventDeltas,
  };
}
