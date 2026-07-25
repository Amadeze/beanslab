import { Resend } from 'resend';
import { formatRupiah } from './format';

// Helper for Resend (Email)
const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder_key_here');

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    })[character]!,
  );
}

async function sendWhatsAppMessage(phone: string, message: string) {
  let formattedPhone = phone.replace(/[^\d+]/g, "");
  if (formattedPhone.startsWith("0")) formattedPhone = `62${formattedPhone.slice(1)}`;
  if (formattedPhone.startsWith("+")) formattedPhone = formattedPhone.slice(1);
  if (!process.env.WA_API_KEY) {
    return { success: true as const, mocked: true as const };
  }

  const response = await fetch(process.env.WA_API_URL || "https://api.fonnte.com/send", {
    method: "POST",
    headers: {
      Authorization: process.env.WA_API_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ target: formattedPhone, message }),
  });
  const body = await response.text();
  if (!response.ok) {
    return {
      success: false as const,
      error: `WhatsApp provider returned ${response.status}: ${body.slice(0, 300)}`,
    };
  }
  return { success: true as const, mocked: false as const };
}

export async function sendInvoiceEmail(to: string, invoiceCode: string, paymentUrl: string | null) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return { success: true, mocked: true };
    }

    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'roastd.id <hello@roastd.id>',
      to: [to],
      subject: `Invoice Anda: ${invoiceCode}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d4a373;">Terima Kasih Atas Pesanan Anda!</h2>
          <p>Berikut adalah invoice untuk pesanan Anda dengan kode: <strong>${escapeHtml(invoiceCode)}</strong>.</p>
          ${paymentUrl ? `
            <p>Silakan selesaikan pembayaran Anda melalui tautan aman Midtrans berikut:</p>
            <a href="${paymentUrl}" style="display: inline-block; padding: 12px 24px; background-color: #d4a373; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 16px 0;">
              Bayar Sekarang
            </a>
          ` : `
            <p>Silakan lakukan pembayaran sesuai instruksi pada invoice.</p>
          `}
          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 32px 0;" />
          <p style="font-size: 12px; color: #666;">
            Email ini dikirim otomatis oleh roastd.id. Harap jangan membalas email ini.
          </p>
        </div>
      `
    });

    if (error) {
      console.error("Resend API Error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Failed to send email:", error);
    return { success: false, error: String(error) };
  }
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetUrl: string,
) {
  if (!process.env.RESEND_API_KEY) {
    console.log("Password reset email mocked because RESEND_API_KEY is not set.");
    return { success: true, mocked: true };
  }

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "roastd.id <hello@roastd.id>",
    to: [to],
    subject: "Reset password roastd.id",
    html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
        <h2>Reset password</h2>
        <p>Halo ${escapeHtml(name)}, kami menerima permintaan reset password untuk akun roastd.id Anda.</p>
        <p>
          <a href="${resetUrl}" style="display:inline-block;padding:12px 20px;background:#0f172a;color:#fff;text-decoration:none;border-radius:6px">
            Buat password baru
          </a>
        </p>
        <p>Tautan ini berlaku selama 30 menit dan hanya dapat digunakan satu kali.</p>
        <p style="font-size:12px;color:#64748b">Abaikan email ini jika Anda tidak meminta reset password.</p>
      </div>
    `,
  });

  if (error) {
    console.error("Password reset email error:", error);
    return { success: false, error };
  }
  return { success: true, data };
}

// Helper for WhatsApp (Fonnte/Watzap Placeholder)
export async function sendInvoiceWhatsApp(phone: string, invoiceCode: string, paymentUrl: string | null) {
  try {
    const message = `Halo! Terima kasih atas pesanan Anda.\n\n` +
      `Kode Invoice: *${invoiceCode}*\n\n` +
      (paymentUrl ? `Silakan selesaikan pembayaran melalui tautan berikut:\n${paymentUrl}\n\n` : '') +
      `Terima kasih telah berbelanja bersama kami!`;

    return await sendWhatsAppMessage(phone, message);
  } catch (error) {
    console.error("Failed to send WA:", error);
    return { success: false, error: String(error) };
  }
}

export async function sendOverdueReminderEmail(input: {
  to: string;
  customerName: string;
  invoiceCode: string;
  tenantName: string;
  balance: number;
  dueDate: Date;
  paymentUrl: string | null;
}) {
  if (!process.env.RESEND_API_KEY) {
    return { success: true as const, mocked: true as const };
  }
  const currency = formatRupiah(input.balance);
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "roastd.id <no-reply@roastd.id>",
    to: [input.to],
    subject: `Pengingat tagihan ${input.invoiceCode}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <h2>Pengingat pembayaran</h2>
        <p>Halo ${escapeHtml(input.customerName)},</p>
        <p>Tagihan <strong>${escapeHtml(input.invoiceCode)}</strong> dari ${escapeHtml(input.tenantName)}
        telah melewati jatuh tempo. Sisa tagihan saat ini adalah <strong>${currency}</strong>.</p>
        ${input.paymentUrl ? `<p><a href="${escapeHtml(input.paymentUrl)}">Bayar sekarang</a></p>` : ""}
        <p>Mohon abaikan pesan ini bila pembayaran baru saja dilakukan.</p>
      </div>
    `,
  });
  if (error) return { success: false as const, error };
  return { success: true as const, data };
}

export async function sendOverdueReminderWhatsApp(input: {
  phone: string;
  customerName: string;
  invoiceCode: string;
  tenantName: string;
  balance: number;
  paymentUrl: string | null;
}) {
  const currency = formatRupiah(input.balance);
  const message =
    `Halo ${input.customerName}, pengingat tagihan *${input.invoiceCode}* dari ${input.tenantName}. ` +
    `Sisa tagihan ${currency} telah melewati jatuh tempo.` +
    (input.paymentUrl ? `\n\nBayar melalui: ${input.paymentUrl}` : "") +
    "\n\nAbaikan pesan ini bila pembayaran baru saja dilakukan.";
  return sendWhatsAppMessage(input.phone, message);
}
