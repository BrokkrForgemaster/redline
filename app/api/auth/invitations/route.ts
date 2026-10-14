import { NextResponse } from "next/server";

// Older clients receive a clear response. Staff accounts are now provisioned
// by the owner without email delivery.
export async function POST() {
  return NextResponse.json({ error: "Email invitations are no longer available. Create a staff account instead." },
    { status: 410 });
}
