import { createHash, createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { quoteInquirySchema } from "@/lib/validations/inquiry";

const MAX_BODY_BYTES = 8192;

export async function POST(request: Request) {
  const rateSecret = process.env.INQUIRY_RATE_SECRET;
  if (!rateSecret || rateSecret.length < 32) {
    return NextResponse.json({ error: "Quote requests are temporarily unavailable. Please call (606) 425-0891." }, { status: 503 });
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return NextResponse.json({ error: "Your request is too long." }, { status: 413 });

  let body: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Your request is too long." }, { status: 413 });
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
  }
  const parsed = quoteInquirySchema.safeParse(body);
  if (!parsed.success || parsed.data.companyWebsite) {
    return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
  }

  const inquiry = parsed.data;
  const normalized = {
    name: inquiry.name,
    email: inquiry.email.toLowerCase(),
    phone: inquiry.phone,
    service: inquiry.service,
    message: inquiry.message,
  };
  const payloadHash = createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
  // Rate buckets use a server secret; public request metadata is never stored.
  const rateBucket = createHmac("sha256", rateSecret).update(normalized.email).digest("hex");
  let data: { lead_id: string; delivery_state: string }[] | null;
  let error: { code?: string } | null;
  try {
    const sb = createAdminClient();
    // The SQL function commits lead, inbox and delivery intent together.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (sb as any).rpc("create_public_quote_inquiry", {
      p_submission_id: inquiry.submissionId,
      p_payload_hash: payloadHash,
      p_rate_bucket: rateBucket,
      p_name: normalized.name,
      p_email: normalized.email,
      p_phone: normalized.phone,
      p_service: normalized.service,
      p_message: normalized.message,
    });
    data = result.data;
    error = result.error;
  } catch {
    return NextResponse.json({ error: "Quote requests are temporarily unavailable. Please call (606) 425-0891." }, { status: 503 });
  }
  if (error) {
    if (error.code === "P0001") return NextResponse.json({ error: "Please wait before sending another request." }, { status: 429 });
    if (error.code === "23505") return NextResponse.json({ error: "This request changed. Please try again." }, { status: 409 });
    return NextResponse.json({ error: "Your request could not be saved. Please call (606) 425-0891." }, { status: 503 });
  }
  const result = data?.[0];
  if (!result?.lead_id) {
    return NextResponse.json({ error: "Your request could not be confirmed. Please retry." }, { status: 503 });
  }
  return NextResponse.json({ saved: true, submissionId: inquiry.submissionId, delivery: result.delivery_state });
}
