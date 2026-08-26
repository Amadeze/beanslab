"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  enforceRateLimit,
  RateLimitError,
} from "@/lib/rate-limit";
import {
  EMAIL_VERIFICATION_TOKEN_TTL_MS,
  consumeEmailVerificationToken,
  createEmailVerificationToken,
  hashEmailVerificationToken,
} from "@/lib/email-verification";
import { sendEmailVerificationEmail } from "@/lib/notifications";
import {
  digestIdentifier,
  emailIdentifier,
  layeredIdentifiers,
  resolveClientIdentity,
} from "@/lib/client-identity";

const GENERIC_RESEND_MESSAGE =
  "Jika email terdaftar dan belum diverifikasi, tautan verifikasi baru akan segera dikirim.";

export type VerifyEmailResult =
  | { success: true }
  | { success: false; error: string };

export async function verifyEmail(token: string): Promise<VerifyEmailResult> {
  try {
    const trimmed = token?.trim();
    if (!trimmed) return { success: false, error: "Tautan verifikasi tidak valid." };

    const requestHeaders = await headers();
    const identity = resolveClientIdentity(requestHeaders);
    await enforceRateLimit({
      scope: "verify-email",
      // Token dipakai sebagai lapisan identitas tambahan: endpoint ini adalah
      // permukaan brute-force token, jadi tiap token dibatasi juga.
      identifiers: layeredIdentifiers(identity, [
        digestIdentifier("verify-token", trimmed),
      ]),
      limit: 20,
      windowSeconds: 60 * 60,
    });

    const record = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash: hashEmailVerificationToken(trimmed) },
      select: { id: true },
    });
    if (!record) {
      return { success: false, error: "Tautan verifikasi tidak valid atau sudah digunakan." };
    }

    await prisma.$transaction(async (tx) => {
      await consumeEmailVerificationToken(tx, { tokenId: record.id });
    });

    return { success: true };
  } catch (error) {
    console.error("[verifyEmail]", error);
    if (error instanceof RateLimitError) {
      return { success: false, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "";
    if (message === "ALREADY_VERIFIED") {
      return { success: false, error: "Email ini sudah terverifikasi. Silakan masuk." };
    }
    if (message === "USER_INACTIVE") {
      return { success: false, error: "Akun dinonaktifkan. Hubungi administrator." };
    }
    if (
      message === "VERIFICATION_TOKEN_INVALID"
    ) {
      return { success: false, error: "Tautan verifikasi kedaluwarsa. Minta tautan baru di bawah." };
    }
    return { success: false, error: "Verifikasi gagal. Coba lagi." };
  }
}

export async function resendVerificationEmail(
  emailInput: string,
): Promise<{ success: true; message: string } | { success: false; message: string }> {
  try {
    const email = emailInput?.toLowerCase().trim();
    const requestHeaders = await headers();
    const identity = resolveClientIdentity(requestHeaders);
    await enforceRateLimit({
      scope: "resend-verification",
      identifiers: layeredIdentifiers(identity, [emailIdentifier(email)]),
      limit: 3,
      windowSeconds: 60 * 60,
    });

    // Pesan generik: jangan bocorkan apakah email terdaftar / sudah verifikasi.
    const generic = { success: true as const, message: GENERIC_RESEND_MESSAGE };
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return generic;

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, isActive: true, emailVerifiedAt: true },
    });
    if (!user || !user.isActive || user.emailVerifiedAt) return generic;

    const token = createEmailVerificationToken();
    await prisma.$transaction([
      prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } }),
      prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: hashEmailVerificationToken(token),
          expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS),
        },
      }),
    ]);

    const appUrl = process.env.APP_URL;
    if (!appUrl) throw new Error("APP_URL environment variable is required");
    await sendEmailVerificationEmail(
      user.email,
      user.name,
      `${appUrl}/verify-email?token=${encodeURIComponent(token)}`,
    );

    return generic;
  } catch (error) {
    console.error("[resendVerificationEmail]", error);
    return {
      success: false,
      message:
        error instanceof RateLimitError
          ? error.message
          : "Permintaan verifikasi belum dapat diproses.",
    };
  }
}
