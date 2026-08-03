// =============================================================================
// EASING VALIDATOR — explicit structural validation for CSS easing values
// =============================================================================

const EASING_KEYWORDS = new Set([
  "linear",
  "ease",
  "ease-in",
  "ease-out",
  "ease-in-out",
]);

const MAX_STEPS = 10000;

// Plain decimal number, no exponent, no NaN/Infinity, no trailing garbage.
const NUMBER_RE = /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/;

/**
 * Validates a CSS easing value against an explicit allowlist grammar:
 *   - keyword: linear | ease | ease-in | ease-out | ease-in-out
 *   - cubic-bezier(x1, y1, x2, y2) — exactly four finite numbers,
 *     x1/x2 within [0, 1], y1/y2 finite (may exceed 1)
 *   - steps(n[, start|end]) — n positive integer up to MAX_STEPS
 *
 * Returns an error message, or null when the value is valid.
 */
export function validateEasing(value: string): string | null {
  const input = value.trim();
  if (!input) return "Easing is empty";

  if (EASING_KEYWORDS.has(input)) return null;

  if (input.startsWith("cubic-bezier(")) {
    return validateCubicBezier(input);
  }

  if (input.startsWith("steps(")) {
    return validateSteps(input);
  }

  return `Unsupported easing value: ${input}`;
}

function validateCubicBezier(input: string): string | null {
  if (!input.endsWith(")")) return "cubic-bezier() must end with ')'";
  const inner = input.slice("cubic-bezier(".length, -1);
  if (inner.includes("(") || inner.includes(")")) {
    return "cubic-bezier() cannot contain nested parentheses";
  }

  const parts = inner.split(",");
  if (parts.length !== 4) {
    return `cubic-bezier() requires exactly 4 numbers, got ${parts.length}`;
  }

  const numbers: number[] = [];
  for (const raw of parts) {
    const part = raw.trim();
    if (!NUMBER_RE.test(part)) {
      return `cubic-bezier() argument is not a plain finite number: ${part}`;
    }
    const num = Number(part);
    if (!Number.isFinite(num)) {
      return `cubic-bezier() argument is not finite: ${part}`;
    }
    numbers.push(num);
  }

  const [x1, y1, x2, y2] = numbers;
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) {
    return `cubic-bezier() x values must be within 0..1 (got x1=${x1}, x2=${x2})`;
  }
  if (!Number.isFinite(y1) || !Number.isFinite(y2)) {
    return "cubic-bezier() y values must be finite";
  }

  return null;
}

function validateSteps(input: string): string | null {
  if (!input.endsWith(")")) return "steps() must end with ')'";
  const inner = input.slice("steps(".length, -1);

  const match = /^\s*(\d+)\s*(?:,\s*(start|end)\s*)?$/.exec(inner);
  if (!match) {
    return "steps() expects steps(n) or steps(n, start|end)";
  }

  const n = Number(match[1]);
  if (!Number.isInteger(n) || n < 1 || n > MAX_STEPS) {
    return `steps() count must be an integer between 1 and ${MAX_STEPS}`;
  }

  return null;
}

/** True when the value is a valid easing per the allowlist grammar. */
export function isValidEasing(value: string): boolean {
  return validateEasing(value) === null;
}
