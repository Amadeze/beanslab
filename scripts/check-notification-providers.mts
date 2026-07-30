import { Resend } from "resend";

type Check = { provider: string; ready: boolean; detail: string };
const checks: Check[] = [];

if (!process.env.RESEND_API_KEY) {
  checks.push({ provider: "email", ready: false, detail: "RESEND_API_KEY belum diisi." });
} else {
  try {
    const response = await new Resend(process.env.RESEND_API_KEY).domains.list();
    if (response.error) throw new Error(response.error.message);
    const domains = response.data?.data ?? [];
    const verified = domains.filter((domain) => domain.status === "verified");
    checks.push({
      provider: "email",
      ready: verified.length > 0,
      detail: verified.length > 0
        ? `${verified.length} domain terverifikasi.`
        : "API key valid, tetapi belum ada domain terverifikasi.",
    });
  } catch (error) {
    checks.push({ provider: "email", ready: false, detail: error instanceof Error ? error.message : "Pemeriksaan Resend gagal." });
  }
}

if (!process.env.WA_API_KEY) {
  checks.push({ provider: "whatsapp", ready: false, detail: "WA_API_KEY belum diisi." });
} else {
  try {
    const response = await fetch("https://api.fonnte.com/device", {
      method: "POST",
      headers: { Authorization: process.env.WA_API_KEY },
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json() as { status?: boolean; device_status?: string; reason?: string; expired?: string };
    const connected = response.ok && payload.status === true && payload.device_status === "connect";
    checks.push({
      provider: "whatsapp",
      ready: connected,
      detail: connected
        ? `Perangkat terhubung${payload.expired ? `; paket berlaku sampai ${payload.expired}` : ""}.`
        : payload.reason || `Status perangkat: ${payload.device_status || "tidak diketahui"}.`,
    });
  } catch (error) {
    checks.push({ provider: "whatsapp", ready: false, detail: error instanceof Error ? error.message : "Pemeriksaan Fonnte gagal." });
  }
}

console.log(JSON.stringify({ ready: checks.every((check) => check.ready), checks }, null, 2));
if (checks.some((check) => !check.ready)) process.exitCode = 1;
