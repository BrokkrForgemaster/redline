import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Email invitations are no longer available." }, { status: 410 });
}
