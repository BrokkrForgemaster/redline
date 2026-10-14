import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { deliverWorkflowPushBatch } from "@/lib/push/deliver";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || !supplied || supplied.length !== secret.length ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(secret))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const result = await deliverWorkflowPushBatch();
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Push delivery unavailable" }, { status: 503 });
  }
}
