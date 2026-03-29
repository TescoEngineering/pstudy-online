import { NextRequest, NextResponse } from "next/server";

const MAX_MESSAGE = 8000;
const MAX_SUBJECT = 200;
const MAX_NAME = 120;

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Sends help/contact form messages to the site operator via Resend.
 * Required env: RESEND_API_KEY, CONTACT_INBOX_EMAIL
 * Optional: CONTACT_FROM_EMAIL (must be a verified sender/domain in Resend; defaults for dev)
 */
export async function POST(request: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  const inbox = process.env.CONTACT_INBOX_EMAIL?.trim();
  const from =
    process.env.CONTACT_FROM_EMAIL?.trim() || "PSTUDY Help <onboarding@resend.dev>";

  if (!apiKey || !inbox) {
    return NextResponse.json(
      { error: "Contact is not configured on this server.", code: "not_configured" },
      { status: 503 }
    );
  }

  let body: {
    email?: string;
    name?: string;
    subject?: string;
    message?: string;
    /** Honeypot — must be empty. Key is not "website" to avoid browser autofill false positives. */
    hp?: string;
    website?: string;
  };
  try {
    body = await request.json();
  } catch {
    return bad("Invalid JSON");
  }

  const trap = (body.hp ?? body.website ?? "").trim();
  if (trap) {
    return NextResponse.json({ ok: true });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const name = (body.name ?? "").trim().slice(0, MAX_NAME);
  const subjectRaw = (body.subject ?? "").trim().slice(0, MAX_SUBJECT);
  const message = (body.message ?? "").trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return bad("Valid email is required");
  }
  if (!message || message.length > MAX_MESSAGE) {
    return bad(`Message is required (max ${MAX_MESSAGE} characters)`);
  }

  const subject = subjectRaw
    ? `[PSTUDY Help] ${subjectRaw}`
    : `[PSTUDY Help] Message from ${email}`;

  const text = [
    `From: ${name ? `${name} <${email}>` : email}`,
    `Subject: ${subjectRaw || "—"}`,
    "",
    message,
    "",
    `— Sent via PSTUDY Help form`,
  ].join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [inbox],
      reply_to: email,
      subject,
      text,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      typeof data.message === "string"
        ? data.message
        : "Could not send message. Please try again later.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
