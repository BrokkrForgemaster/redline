import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { deliverInquiryBatch } from "@/lib/inquiries/deliver";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || !supplied || supplied.length !== secret.length ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(secret))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    return NextResponse.json(await deliverInquiryBatch());
  } catch {
    return NextResponse.json({ error: "Inquiry delivery unavailable" }, { status: 503 });
  }
}
