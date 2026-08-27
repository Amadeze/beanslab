export type MidtransSupportInput = {
  clientKey?: string;
  serverKey?: string;
  isProduction: boolean;
  environmentChanged: boolean;
};

export function validateMidtransSupportInput(input: MidtransSupportInput): string | null {
  const clientKey = input.clientKey?.trim();
  const serverKey = input.serverKey?.trim();

  if (input.environmentChanged && (!clientKey || !serverKey)) {
    return "Perubahan Sandbox/Production wajib menyertakan Client Key dan Server Key baru.";
  }
  if (!clientKey && !serverKey && !input.environmentChanged) {
    return "Masukkan credential baru atau ubah environment Midtrans.";
  }

  const expectedClientPrefix = input.isProduction ? "Mid-client-" : "SB-Mid-client-";
  const expectedServerPrefix = input.isProduction ? "Mid-server-" : "SB-Mid-server-";
  if (clientKey && !clientKey.startsWith(expectedClientPrefix)) {
    return `Client Key tidak cocok dengan mode ${input.isProduction ? "Production" : "Sandbox"}.`;
  }
  if (serverKey && !serverKey.startsWith(expectedServerPrefix)) {
    return `Server Key tidak cocok dengan mode ${input.isProduction ? "Production" : "Sandbox"}.`;
  }
  return null;
}
