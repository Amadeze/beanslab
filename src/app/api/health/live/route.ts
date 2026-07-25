import { NextResponse } from "next/server";
import { getRequestId } from "@/lib/api-observability";
import { getCurrentDate } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const requestId = getRequestId(req.headers);
  return NextResponse.json(
    {
      status: "ok",
      timestamp: getCurrentDate().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
      },
    },
  );
}
