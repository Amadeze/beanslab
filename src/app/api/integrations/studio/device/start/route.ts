import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, RateLimitError, requestIdentifier } from "@/lib/rate-limit";
import {
  generateStudioDeviceCode,
  generateStudioVerificationCode,
  hashStudioDeviceCode,
  hashStudioVerificationCode,
} from "@/lib/artisan/connector-auth";
import { StartStudioDeviceAuthorizationSchema } from "@/lib/artisan/types";
import { getRequestId, internalErrorResponse, logServerError } from "@/lib/api-observability";

const AUTHORIZATION_TTL_MS = 10 * 60 * 1000;

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request.headers);
  try {
    await enforceRateLimit({
      scope: "studio:device-start",
      identifier: requestIdentifier(request.headers),
      limit: 8,
      windowSeconds: 60,
    });

    const parsed = StartStudioDeviceAuthorizationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: "Identitas Studio tidak valid." } },
        { status: 400 },
      );
    }

    const deviceCode = generateStudioDeviceCode();
    const verificationCode = generateStudioVerificationCode();
    const expiresAt = new Date(Date.now() + AUTHORIZATION_TTL_MS);

    await prisma.studioDeviceAuthorization.create({
      data: {
        ...parsed.data,
        deviceCodeHash: hashStudioDeviceCode(deviceCode),
        verificationCodeHash: hashStudioVerificationCode(verificationCode),
        expiresAt,
      },
    });

    const verificationUrl = new URL("/studio/authorize", request.url);
    verificationUrl.searchParams.set("code", verificationCode);

    return NextResponse.json({
      deviceCode,
      verificationUrl: verificationUrl.toString(),
      expiresAt: expiresAt.toISOString(),
      intervalSeconds: 2,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: error.message } },
        { status: 429, headers: { "Retry-After": String(error.retryAfter) } },
      );
    }
    logServerError("studio.device-start", error, { requestId });
    return internalErrorResponse(requestId, "Gagal memulai login Studio.");
  }
}
