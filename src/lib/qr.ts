import QRCode from "qrcode";

export interface LocationQrData {
  type: "LOCATION";
  code: string;
}

export interface LotQrData {
  type: "LOT";
  batchCode: string;
}

export type QrPayload = LocationQrData | LotQrData;

function parseQrCode(raw: string): QrPayload | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && (parsed.type === "LOCATION" || parsed.type === "LOT")) {
      return parsed as QrPayload;
    }
  } catch {
    // not JSON — maybe plain code
  }
  return null;
}

export function encodeLocationQr(code: string): string {
  return JSON.stringify({ type: "LOCATION", code });
}

export function encodeLotQr(batchCode: string): string {
  return JSON.stringify({ type: "LOT", batchCode });
}

export async function generateQrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    width: 200,
    margin: 1,
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}

export function parseQrPayload(raw: string): { type: "LOCATION"; code: string } | { type: "LOT"; batchCode: string } | { type: "RAW"; code: string } {
  const parsed = parseQrCode(raw);
  if (parsed?.type === "LOCATION") return { type: "LOCATION", code: parsed.code };
  if (parsed?.type === "LOT") return { type: "LOT", batchCode: parsed.batchCode };
  return { type: "RAW", code: raw };
}
