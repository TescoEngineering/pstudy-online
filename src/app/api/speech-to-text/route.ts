/**
 * Google Cloud Speech-to-Text API route.
 * Receives audio (WebM/Opus), returns transcript with phrase hints for better accuracy.
 */

import { NextRequest, NextResponse } from "next/server";
import speech from "@google-cloud/speech";
import { resolveDeckOnlyTranscript } from "@/lib/speech";
import { normalizeSpeechLocale } from "@/lib/speech-locale";

export const runtime = "nodejs";

function getSpeechClient() {
  // Support credentials via JSON string (Vercel/serverless) or file path (local)
  const jsonCreds = process.env.GOOGLE_CLOUD_CREDENTIALS_JSON;
  if (jsonCreds) {
    try {
      const credentials = JSON.parse(jsonCreds);
      return new speech.SpeechClient({ credentials });
    } catch {
      console.error("Invalid GOOGLE_CLOUD_CREDENTIALS_JSON");
      return null;
    }
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return new speech.SpeechClient();
  }
  return null;
}

/** Surface common Google API failures without leaking credential details */
function friendlyGoogleError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  if (
    lower.includes("permission_denied") ||
    lower.includes("7 denied") ||
    raw.includes("PERMISSION_DENIED")
  ) {
    return (
      "Google Cloud denied access. Enable the Speech-to-Text API, link billing if prompted, " +
      "and grant this service account the role “Cloud Speech Client” (roles/speech.client)."
    );
  }
  if (
    lower.includes("not found") ||
    lower.includes("has not been enabled") ||
    lower.includes("service_disabled") ||
    lower.includes("billing")
  ) {
    if (lower.includes("billing")) {
      return "Google Cloud Speech-to-Text requires a billing account on this project (free tier still applies up to the monthly limit).";
    }
    return "Speech-to-Text API may be disabled. In Google Cloud Console → APIs & Services → Library, enable “Speech-to-Text API”.";
  }
  if (lower.includes("invalid_grant") || lower.includes("invalid_")) {
    return "Invalid Google credentials. Check GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_CLOUD_CREDENTIALS_JSON.";
  }
  return raw;
}

export async function POST(request: NextRequest) {
  const client = getSpeechClient();
  if (!client) {
    return NextResponse.json(
      { error: "Google Cloud Speech-to-Text not configured" },
      { status: 503 }
    );
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as Blob | null;
    const phrasesRaw = formData.get("phrases") as string | null;
    const lang = normalizeSpeechLocale(
      String(formData.get("lang") || "en")
    );

    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json(
        { error: "Missing or invalid audio" },
        { status: 400 }
      );
    }

    const phrases: string[] = phrasesRaw
      ? (JSON.parse(phrasesRaw) as string[]).filter(
          (p): p is string => typeof p === "string" && p.length > 0
        )
      : [];
    /** Full list for deck resolution (must match client). Google speechContexts cap at 500 phrases. */
    const phrasesForResolve = phrases;
    const phraseHintsForGoogle = phrases.slice(0, 500);

    const arrayBuffer = await audioFile.arrayBuffer();
    const audioContent = Buffer.from(arrayBuffer);

    const [response] = await client.recognize({
      config: {
        encoding: "WEBM_OPUS" as const,
        sampleRateHertz: 48000, // Opus often 48kHz
        languageCode: lang,
        // Omit latest_short: it is tuned for brief commands and often returns empty for silence-heavy slices
        // (user pauses before answering). Default model copes better with variable lead-in within a chunk.
        // Ask for n-best list: correct syllable is often hypothesis 2–5. SAPI-style *grammar* is N/A in Google STT.
        ...(phraseHintsForGoogle.length ? { maxAlternatives: 12 } : {}),
        speechContexts: phraseHintsForGoogle.length
          ? [{ phrases: phraseHintsForGoogle, boost: 10 }]
          : [],
      },
      audio: { content: audioContent },
    });

    /** Google returns alternatives sorted by confidence; flatten in order. */
    const orderedAlternatives: string[] = [];
    for (const r of response.results ?? []) {
      for (const a of r.alternatives ?? []) {
        const t = a.transcript?.trim();
        if (t) orderedAlternatives.push(t);
      }
    }

    let transcript = "";

    if (phrasesForResolve.length > 0) {
      for (const cand of orderedAlternatives) {
        const resolved = resolveDeckOnlyTranscript(cand, phrasesForResolve);
        if (resolved) {
          transcript = resolved;
          break;
        }
      }
      if (!transcript && orderedAlternatives.length > 0) {
        const merged = resolveDeckOnlyTranscript(
          orderedAlternatives.join(" "),
          phrasesForResolve
        );
        if (merged) transcript = merged;
      }
      // If strict resolution missed (e.g. odd chunking), return raw STT so the client can run
      // resolveDeckOnlyTranscript again on a single hypothesis (whole-phrase fuzzy, extract).
      if (!transcript && orderedAlternatives.length > 0) {
        transcript = orderedAlternatives[0] ?? "";
      }
    } else if (orderedAlternatives.length > 0) {
      transcript = orderedAlternatives[0] ?? "";
    }

    return NextResponse.json({
      transcript,
      // Helpful while tuning; small payloads only
      alternatives: orderedAlternatives.slice(0, 8),
    });
  } catch (err) {
    console.error("Speech-to-Text error:", err);
    const msg = friendlyGoogleError(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
