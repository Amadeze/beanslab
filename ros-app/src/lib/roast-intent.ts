export type RoastOutcomeStatus = "NORMAL" | "REVIEW";

export type RoastOutcome = {
  inputKg: number;
  outputKg: number;
  lossKg: number;
  lossPercent: number;
  yieldPercent: number;
  expectedLossPercent: number;
  expectedMinPercent: number;
  expectedMaxPercent: number;
  historySampleCount: number;
  status: RoastOutcomeStatus;
};

const DEFAULT_EXPECTED_LOSS_PERCENT = 15;
const DEFAULT_MIN_LOSS_PERCENT = 8;
const DEFAULT_MAX_LOSS_PERCENT = 25;
const MIN_HISTORY_SAMPLES = 3;

function round(value: number, precision = 2) {
  const multiplier = 10 ** precision;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

function validHistoricalLosses(losses: number[]) {
  return losses
    .filter((loss) => Number.isFinite(loss) && loss > 0 && loss < 100)
    .slice(0, 10);
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

/**
 * Converts the two facts measured on the production floor into a repeatable
 * quality signal. Three or more comparable roasts create an adaptive range;
 * new profiles use a deliberately broad fallback so valid roasts are warned,
 * never blocked, while the system is still learning.
 */
export function analyzeRoastOutcome(
  inputKg: number,
  outputKg: number,
  recentComparableLosses: number[] = [],
): RoastOutcome {
  if (!Number.isFinite(inputKg) || inputKg <= 0) {
    throw new Error("Berat Green Bean harus lebih dari 0 kg.");
  }
  if (!Number.isFinite(outputKg) || outputKg <= 0) {
    throw new Error("Berat Roasted Bean harus lebih dari 0 kg.");
  }
  if (outputKg >= inputKg) {
    throw new Error("Berat Roasted Bean harus lebih kecil dari berat Green Bean.");
  }

  const losses = validHistoricalLosses(recentComparableLosses);
  const lossKg = inputKg - outputKg;
  const lossPercent = (lossKg / inputKg) * 100;
  const yieldPercent = (outputKg / inputKg) * 100;

  let expectedLossPercent = DEFAULT_EXPECTED_LOSS_PERCENT;
  let expectedMinPercent = DEFAULT_MIN_LOSS_PERCENT;
  let expectedMaxPercent = DEFAULT_MAX_LOSS_PERCENT;

  if (losses.length >= MIN_HISTORY_SAMPLES) {
    expectedLossPercent = median(losses);
    const medianAbsoluteDeviation = median(
      losses.map((loss) => Math.abs(loss - expectedLossPercent)),
    );
    const tolerance = Math.max(2.5, medianAbsoluteDeviation * 2.9652);
    expectedMinPercent = Math.max(0.01, expectedLossPercent - tolerance);
    expectedMaxPercent = Math.min(99.99, expectedLossPercent + tolerance);
  }

  return {
    inputKg: round(inputKg, 3),
    outputKg: round(outputKg, 3),
    lossKg: round(lossKg, 3),
    lossPercent: round(lossPercent),
    yieldPercent: round(yieldPercent),
    expectedLossPercent: round(expectedLossPercent),
    expectedMinPercent: round(expectedMinPercent),
    expectedMaxPercent: round(expectedMaxPercent),
    historySampleCount: losses.length,
    status:
      lossPercent < expectedMinPercent || lossPercent > expectedMaxPercent
        ? "REVIEW"
        : "NORMAL",
  };
}
