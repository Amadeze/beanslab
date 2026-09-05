export interface RoastCurvePoint {
  second: number;
  value: number;
}

export function computeRoRSeries(
  points: RoastCurvePoint[],
  windowSeconds = 30,
): Array<{ second: number; value: number | null }> {
  if (points.length === 0) return [];
  const sorted = [...points].sort((a, b) => a.second - b.second);
  return sorted.map((point, index) => {
    const lo = sorted.findIndex(
      (other) => other.second >= point.second - windowSeconds,
    );
    const hi = sorted.findIndex(
      (other) => other.second > point.second + windowSeconds,
    );
    if (lo < 0 || hi < 0 || lo === index || hi === index) {
      return { second: point.second, value: null };
    }
    const left = sorted[lo];
    const right = sorted[hi];
    const dt = right.second - left.second;
    if (dt <= 0) return { second: point.second, value: null };
    const ror = ((right.value - left.value) / dt) * 60;
    return { second: point.second, value: ror };
  });
}