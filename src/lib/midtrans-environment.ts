export function midtransSnapUrl(input: {
  clientKey?: string | null;
  explicitProduction?: string | boolean | null;
}) {
  const explicit = typeof input.explicitProduction === "string"
    ? input.explicitProduction.toLowerCase() === "true"
    : input.explicitProduction;
  const isProduction = explicit ?? !input.clientKey?.trim().toUpperCase().startsWith("SB-");
  return isProduction
    ? "https://app.midtrans.com/snap/snap.js"
    : "https://app.sandbox.midtrans.com/snap/snap.js";
}
