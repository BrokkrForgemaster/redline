import { NextResponse } from "next/server";

const FORMSUBMIT_URL =
  "https://formsubmit.co/ajax/redlineofkentucky@gmail.com";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, phone, service, message } = body;

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Name, email, and message are required." },
        { status: 400 }
      );
    }

    const res = await fetch(FORMSUBMIT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        name,
        email,
        phone: phone || "Not provided",
        service: service || "Not specified",
        message,
        _subject: `New Quote Request — ${service || "General"} — ${name}`,
        _replyto: email,
        _template: "table",
      }),
    });

    if (!res.ok) {
      console.error("FormSubmit error:", await res.text());
      return NextResponse.json(
        { error: "Failed to send. Please call us at (606) 425-0891." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Contact form error:", e);
    return NextResponse.json(
      { error: "Something went wrong. Please call us at (606) 425-0891." },
      { status: 500 }
    );
  }
}
