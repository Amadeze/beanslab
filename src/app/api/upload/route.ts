import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import {
  enforceRateLimit,
  RateLimitError,
} from "@/lib/rate-limit";
import {
  layeredIdentifiers,
  resolveClientIdentity,
  tenantIdentifier,
  userIdentifier,
} from "@/lib/client-identity";
import { hasValidImageSignature, uploadImage } from "@/lib/storage";
import {
  getRequestId,
  internalErrorResponse,
  logServerError,
} from "@/lib/api-observability";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req.headers);
  try {
    const user = await getCurrentUser();
    if (!user || !["OWNER", "MANAGER"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const identity = resolveClientIdentity(req.headers);
    await enforceRateLimit({
      scope: "upload",
      identifiers: layeredIdentifiers(identity, [
        tenantIdentifier(user.tenantId),
        userIdentifier(user.id),
      ]),
      limit: 20,
      windowSeconds: 60 * 60,
    });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Max 5MB allowed." },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only images allowed." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    if (!hasValidImageSignature(buffer, file.type)) {
      return NextResponse.json(
        { error: "File content does not match its image type." },
        { status: 400 },
      );
    }
    const imageUrl = await uploadImage({
      tenantId: user.tenantId,
      buffer,
      mimeType: file.type,
    });
    
    return NextResponse.json({ url: imageUrl, success: true });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return NextResponse.json(
        { error: e.message },
        { status: 429, headers: { "Retry-After": String(e.retryAfter) } },
      );
    }
    logServerError("upload", e, { requestId });
    return internalErrorResponse(requestId, "Upload gagal diproses.");
  }
}
