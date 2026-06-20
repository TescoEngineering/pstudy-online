import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

// nodemailer needs Node APIs (net/tls) — must not run on the Edge runtime.
export const runtime = "nodejs";

const MAX_MESSAGE = 8000;
const MAX_SUBJECT = 200;
const MAX_NAME = 120;

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Sends help/contact form messages to the site operator via the project's own
 * SMTP server (Cloud86), authenticated as the contact mailbox. Because this is
 * an authenticated submission, it is delivered locally into the inbox and
 * bypasses the inbound spam blocklist (bl.cloud86-dnsbl.io) that was bouncing
 * mail relayed via Resend/Amazon SES.
 *
 * User-facing auth emails (signup/login/reset) still go through Supabase+Resend —
 * this route only changes how the contact form reaches contact@pstudy.be.
 *
 * Required env: SMTP_HOST, SMTP_USER, SMTP_PASS, CONTACT_INBOX_EMAIL
 * Optional: SMTP_PORT (default 587), CONTACT_FROM_EMAIL (default SMTP_USER)
 */
export async function POST(request: NextRequest) {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  const port = Number.parseInt(process.env.SMTP_PORT?.trim() || "587", 10);
  const inbox = process.env.CONTACT_INBOX_EMAIL?.trim();
  const from = process.env.CONTACT_FROM_EMAIL?.trim() || user || "";

  if (!host || !user || !pass || !inbox) {
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

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({
      from,
      to: inbox,
      replyTo: email,
      subject,
      text,
    });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Could not send message. Please try again later.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
