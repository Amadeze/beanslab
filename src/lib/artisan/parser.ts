import type { ParsedArtisanRoast } from "./types";

export type ParseResult =
  | { success: true; data: ParsedArtisanRoast }
  | { success: false; errorCode: string; errorMessage: string };

/**
 * Parse time string "MM:SS" to seconds.
 */
function parseTimeToSeconds(time: string): number {
  const parts = time.split(":");
  if (parts.length !== 2) return 0;
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

/**
 * Convert Fahrenheit to Celsius.
 */
function fToC(f: number): number {
  return Math.round(((f - 32) * 5) / 9 * 100) / 100;
}

/**
 * Convert a Python dict literal string to a JavaScript object.
 * Handles: single quotes, True/False/None, trailing commas, nested dicts/lists.
 */
function parsePythonDict(str: string): Record<string, unknown> {
  // Step 1: Convert Python booleans and None
  let s = str
    .replace(/(?<!\w)True(?!\w)/g, "true")
    .replace(/(?<!\w)False(?!\w)/g, "false")
    .replace(/(?<!\w)None(?!\w)/g, "null");

  // Step 2: Try JSON parse directly (handles double-quoted strings)
  try {
    return JSON.parse(s);
  } catch {
    // Continue with single-quote conversion
  }

  // Step 3: Convert single-quoted strings to double-quoted
  // This is tricky because strings can contain apostrophes (e.g., "Sweet Maria's")
  // Strategy: process character by state machine
  s = convertPythonSingleQuotes(s);

  // Step 4: Remove trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, "$1");

  // Step 5: Try JSON parse again
  try {
    return JSON.parse(s);
  } catch {
    // If still fails, fall back to regex extraction
    return extractFieldsViaRegex(str);
  }
}

/**
 * Convert Python single-quoted strings to double-quoted JSON strings.
 * Handles apostrophes inside strings like "Sweet Maria's".
 */
function convertPythonSingleQuotes(input: string): string {
  const result: string[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (ch === "'") {
      // Start of a single-quoted string
      let j = i + 1;
      let inner = "";
      while (j < input.length) {
        if (input[j] === "\\") {
          // Escaped character
          inner += input[j + 1] || "";
          j += 2;
        } else if (input[j] === "'") {
          // End of string — check for triple quote
          if (input[j + 1] === "'" && input[j + 2] === "'") {
            // Triple-quoted string
            j += 3;
            let tripleInner = inner;
            while (j < input.length) {
              if (input[j] === "\\") {
                tripleInner += input[j + 1] || "";
                j += 2;
              } else if (input[j] === "'" && input[j + 1] === "'" && input[j + 2] === "'") {
                j += 3;
                break;
              } else {
                tripleInner += input[j];
                j++;
              }
            }
            // Escape double quotes in the content
            result.push(`"${tripleInner.replace(/"/g, '\\"')}"`);
            i = j;
            break;
          } else {
            // Regular single-quoted string end
            // Escape double quotes in the content
            result.push(`"${inner.replace(/"/g, '\\"')}"`);
            i = j + 1;
            break;
          }
        } else {
          inner += input[j];
          j++;
        }
      }
      if (j >= input.length && i < input.length) {
        // Unterminated string, push what we have
        result.push(`"${inner.replace(/"/g, '\\"')}"`);
        i = j;
      }
    } else if (ch === '"') {
      // Double-quoted string — skip through
      let j = i + 1;
      while (j < input.length) {
        if (input[j] === "\\") {
          j += 2;
        } else if (input[j] === '"') {
          j++;
          break;
        } else {
          j++;
        }
      }
      result.push(input.slice(i, j));
      i = j;
    } else {
      result.push(ch);
      i++;
    }
  }

  return result.join("");
}

/**
 * Fallback: extract key fields via regex when JSON parse fails.
 */
function extractFieldsViaRegex(str: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  const titleMatch = str.match(/'title':\s*'([^']+)'/);
  if (titleMatch) result.title = titleMatch[1];

  const beansMatch = str.match(/'beans':\s*'([^']*(?:\\.[^']*)*)'/);
  if (beansMatch) result.beans = beansMatch[1].replace(/\\n/g, "\n");

  const weightMatch = str.match(/'weight':\s*\[([^,\]]+),\s*([^,\]]+)/);
  if (weightMatch) {
    result.weight = [parseFloat(weightMatch[1]), parseFloat(weightMatch[2])];
  }

  const roastdateMatch = str.match(/'roastdate':\s*'([^']+)'/);
  if (roastdateMatch) result.roastdate = roastdateMatch[1];

  const roasttimeMatch = str.match(/'roasttime':\s*'([^']+)'/);
  if (roasttimeMatch) result.roasttime = roasttimeMatch[1];

  const orgMatch = str.match(/'organization':\s*'([^']+)'/);
  if (orgMatch) result.organization = orgMatch[1];

  const roasterMatch = str.match(/'roastertype':\s*'([^']+)'/);
  if (roasterMatch) result.roastertype = roasterMatch[1];

  const modeMatch = str.match(/'mode':\s*'([FC])'/);
  if (modeMatch) result.mode = modeMatch[1];

  return result;
}

/**
 * Extract a numeric array from a parsed object by key.
 */
function getNumberArray(obj: Record<string, unknown>, key: string): number[] {
  const val = obj[key];
  if (Array.isArray(val)) {
    return val.map((v) => (typeof v === "number" ? v : parseFloat(String(v)))).filter((v) => !isNaN(v));
  }
  return [];
}

/**
 * Parse a raw .alog file buffer into a normalized roast record.
 */
export function parseAlog(buffer: Buffer, filename: string): ParseResult {
  try {
    const content = buffer.toString("utf-8");

    // Check if it's Python dict format (starts with {)
    if (content.trimStart().startsWith("{")) {
      return parsePythonDictFormat(content, filename);
    }

    // Check if it's XML format
    if (content.trimStart().startsWith("<?xml") || content.trimStart().startsWith("<roast")) {
      return parseXmlFormat(content, filename);
    }

    return {
      success: false,
      errorCode: "UNSUPPORTED_ALOG_VERSION",
      errorMessage: "Format .alog tidak dikenali.",
    };
  } catch (err) {
    return {
      success: false,
      errorCode: "PARSER_ERROR",
      errorMessage: `Gagal parse file .alog: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function parsePythonDictFormat(content: string, filename: string): ParseResult {
  const data = parsePythonDict(content);

  if (!data.title && !data.beans) {
    return {
      success: false,
      errorCode: "INVALID_FILE",
      errorMessage: "File .alog tidak memiliki data yang valid.",
    };
  }

  // Determine temperature mode (Fahrenheit or Celsius)
  const mode = (data.mode as string) || "C";
  const isFahrenheit = mode.toUpperCase() === "F";

  // Helper to convert temperature if needed
  const convertTemp = (t: number) => (isFahrenheit ? fToC(t) : t);

  // Extract weight
  const weight = data.weight as (number | string)[];
  const greenWeightGrams = weight?.[0] != null ? Number(weight[0]) : undefined;
  const roastedWeightGrams = weight?.[1] != null ? Number(weight[1]) : undefined;
  const lossPercent =
    greenWeightGrams && roastedWeightGrams
      ? ((greenWeightGrams - roastedWeightGrams) / greenWeightGrams) * 100
      : undefined;

  // Extract computed values
  const computed = (data.computed || {}) as Record<string, number>;

  // Extract temperature curves
  const timex = getNumberArray(data, "timex");
  const temp1 = getNumberArray(data, "temp1"); // BT
  const temp2 = getNumberArray(data, "temp2"); // ET

  const beanTemperatureSeries: ParsedArtisanRoast["beanTemperatureSeries"] = [];
  const environmentalTemperatureSeries: ParsedArtisanRoast["environmentalTemperatureSeries"] = [];

  for (let i = 0; i < timex.length; i++) {
    const second = Math.round(timex[i] * 100) / 100;
    if (i < temp1.length && !isNaN(temp1[i])) {
      beanTemperatureSeries.push({ second, value: convertTemp(temp1[i]) });
    }
    if (i < temp2.length && !isNaN(temp2[i])) {
      environmentalTemperatureSeries.push({ second, value: convertTemp(temp2[i]) });
    }
  }

  // Extract events from timeindex and computed
  const timeindex = getNumberArray(data, "timeindex");
  const events: ParsedArtisanRoast["events"] = [];

  // Event types by index position in timeindex array
  const eventTypes = ["CHARGE", "DRY_END", "FCs", "FCe", "SCs", "SCe", "DROP"];

  for (let i = 0; i < Math.min(timeindex.length, eventTypes.length); i++) {
    const idx = Math.round(timeindex[i]);
    if (idx > 0 && idx < timex.length) {
      const second = timex[idx];
      const eventType = eventTypes[i];
      const btTemp = idx < temp1.length ? convertTemp(temp1[idx]) : undefined;
      const etTemp = idx < temp2.length ? convertTemp(temp2[idx]) : undefined;

      events.push({
        second,
        type: eventType,
        value: btTemp != null && etTemp != null ? `${btTemp}/${etTemp}` : btTemp,
        label: eventType,
      });
    }
  }

  // Add special events from computed if available
  if (computed.TP_time != null && computed.TP_idx != null) {
    const tpIdx = Math.round(computed.TP_idx);
    if (tpIdx >= 0 && tpIdx < timex.length) {
      events.push({
        second: timex[tpIdx],
        type: "TP",
        value: computed.TP_BT != null ? convertTemp(computed.TP_BT) : undefined,
        label: "Turning Point",
      });
    }
  }

  // Sort events by time
  events.sort((a, b) => a.second - b.second);

  // Extract key timing from computed
  const chargeTime = computed.CHARGE_time ?? (timeindex[0] > 0 ? timex[Math.round(timeindex[0])] : undefined);
  const dropTime = computed.DROP_time ?? (timeindex[6] > 0 ? timex[Math.round(timeindex[6])] : undefined);
  const durationSeconds = computed.totaltime ?? (chargeTime != null && dropTime != null ? dropTime - chargeTime : undefined);

  // Build the result
  const result: ParsedArtisanRoast = {
    source: "artisan",
    sourceVersion: (data.version as string) || (data.recording_version as string),
    title: data.title as string,
    roastDate: (data.roastisodate as string) || (data.roastdate as string),
    chargeTime,
    dropTime,
    durationSeconds,
    chargeTemperature: computed.CHARGE_BT != null ? convertTemp(computed.CHARGE_BT) : undefined,
    dropTemperature: computed.DROP_BT != null ? convertTemp(computed.DROP_BT) : undefined,
    dryEndTime: computed.DRY_time,
    firstCrackStartTime: computed.FCs_time,
    firstCrackEndTime: computed.FCe_time,
    secondCrackStartTime: computed.SCs_time,
    beanTemperatureSeries,
    environmentalTemperatureSeries,
    events,
    metadata: {
      beans: data.beans,
      organization: data.organization,
      roaster: data.roastertype,
      operator: data.operator,
      mode,
      ambientTemp: data.ambientTemp,
      phases: data.phases,
      roastTime: data.roasttime,
      roastEpoch: data.roastepoch,
      cuppingNotes: data.cuppingnotes,
      roastingNotes: data.roastingnotes,
      greenWeightGrams,
      roastedWeightGrams,
      lossPercent: lossPercent ?? computed.weight_loss,
      computed,
    },
  };

  return { success: true, data: result };
}

function parseXmlFormat(content: string, filename: string): ParseResult {
  // Keep existing XML parser for backward compatibility
  const title = extractTag(content, "title");
  const beans = extractTag(content, "beans");
  const notes = extractTag(content, "notes");
  const sourceVersion = extractTag(content, "softwareVersion");

  // Extract weight
  const greenWeight = extractAttr(content, "weight", "green");
  const roastedWeight = extractAttr(content, "weight", "roasted");
  const lossPercentAttr = extractAttr(content, "weight", "loss");

  // Extract time info
  const timeTagMatch = content.match(/<time\s+([^>]+)\/?>/i);
  let chargeTime: number | undefined;
  let dropTime: number | undefined;
  let durationSeconds: number | undefined;

  if (timeTagMatch) {
    const timeAttrs = timeTagMatch[1];
    const chargeMatch = timeAttrs.match(/charge=["']([^"']+)["']/);
    const dropMatch = timeAttrs.match(/drop=["']([^"']+)["']/);
    const totalMatch = timeAttrs.match(/total=["']([^"']+)["']/);
    if (chargeMatch) chargeTime = parseTimeToSeconds(chargeMatch[1]);
    if (dropMatch) dropTime = parseTimeToSeconds(dropMatch[1]);
    if (totalMatch) durationSeconds = parseTimeToSeconds(totalMatch[1]);
  }

  // Extract events
  const events: ParsedArtisanRoast["events"] = [];
  const eventRegex = /<event\s+name=["']([^"']+)["']\s+time=["']([^"']+)["']\s+tempBT=["']([^"']+)["']\s+tempET=["']([^"']+)["']\s*\/?>/gi;
  let eventMatch;
  while ((eventMatch = eventRegex.exec(content)) !== null) {
    events.push({
      second: parseTimeToSeconds(eventMatch[2]),
      type: eventMatch[1],
      value: `${eventMatch[3]}/${eventMatch[4]}`,
      label: eventMatch[1],
    });
  }

  // Extract charge and drop temperatures from events
  const chargeEvent = events.find((e) => e.type === "CHARGE");
  const dropEvent = events.find((e) => e.type === "DROP");
  const chargeTemperature = chargeEvent
    ? parseFloat(String(chargeEvent.value).split("/")[0])
    : undefined;
  const dropTemperature = dropEvent
    ? parseFloat(String(dropEvent.value).split("/")[0])
    : undefined;

  // Extract temperature curves
  const beanTemperatureSeries: ParsedArtisanRoast["beanTemperatureSeries"] = [];
  const environmentalTemperatureSeries: ParsedArtisanRoast["environmentalTemperatureSeries"] = [];
  const pointRegex = /<point\s+time=["']([^"']+)["']\s+bt=["']([^"']+)["']\s+et=["']([^"']+)["']\s*\/?>/gi;
  let pointMatch;
  while ((pointMatch = pointRegex.exec(content)) !== null) {
    const second = parseTimeToSeconds(pointMatch[1]);
    const bt = parseFloat(pointMatch[2]);
    const et = parseFloat(pointMatch[3]);
    if (!isNaN(bt)) {
      beanTemperatureSeries.push({ second, value: bt });
    }
    if (!isNaN(et)) {
      environmentalTemperatureSeries.push({ second, value: et });
    }
  }

  // Build the result
  const result: ParsedArtisanRoast = {
    source: "artisan",
    sourceVersion: sourceVersion ?? undefined,
    title: title ?? filename.replace(/\.alog$/i, ""),
    roastDate: undefined,
    chargeTime,
    dropTime,
    durationSeconds,
    chargeTemperature,
    dropTemperature,
    beanTemperatureSeries,
    environmentalTemperatureSeries,
    events,
    metadata: {
      beans,
      notes,
      greenWeightGrams: greenWeight ? parseFloat(greenWeight) : undefined,
      roastedWeightGrams: roastedWeight ? parseFloat(roastedWeight) : undefined,
      lossPercent: lossPercentAttr ? parseFloat(lossPercentAttr) : undefined,
    },
  };

  return { success: true, data: result };
}

function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, "i");
  const match = xml.match(regex);
  return match?.[1]?.trim() ?? null;
}

function extractAttr(xml: string, tag: string, attr: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*${attr}=["']([^"']*)["'][^>]*\\/>`, "i");
  const match = xml.match(regex);
  return match?.[1]?.trim() ?? null;
}

/**
 * Validate that a file has .alog extension.
 */
export function isAlogFile(filename: string): boolean {
  return filename.toLowerCase().endsWith(".alog");
}
