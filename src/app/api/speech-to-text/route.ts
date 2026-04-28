/**
 * Speech-to-Text: Google Cloud (phrase hints).
 * Not a strict vocabulary grammar — deck matching is done in app code (resolveDeckOnlyTranscript).
 */

import { NextRequest, NextResponse } from "next/server";
import speech from "@google-cloud/speech";
import {
  expandPhraseHintsForGoogle,
  finalizeDeckSttFromAlternatives,
} from "@/lib/speech";
import { normalizeSpeechLocale } from "@/lib/speech-locale";
import { normalizeSttAliasKey } from "@/lib/speech-deck-aliases";

export const runtime = "nodejs";

function getSpeechClient() {
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
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const audioFile = formData.get("audio") as Blob | null;
  const phrasesRaw = formData.get("phrases") as string | null;
  const aliasesRaw = formData.get("aliases") as string | null;
  const lang = normalizeSpeechLocale(String(formData.get("lang") || "en"));

  if (!audioFile || !(audioFile instanceof Blob)) {
    return NextResponse.json({ error: "Missing or invalid audio" }, { status: 400 });
  }

  const phrases: string[] = phrasesRaw
    ? (JSON.parse(phrasesRaw) as string[]).filter(
        (p): p is string => typeof p === "string" && p.length > 0
      )
    : [];
  const phrasesForResolve = phrases;

  let userAliases: Record<string, string> = {};
  if (aliasesRaw && typeof aliasesRaw === "string") {
    try {
      const parsed = JSON.parse(aliasesRaw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof k === "string" && typeof v === "string" && k.trim() && v.trim()) {
            const nk = normalizeSttAliasKey(k);
            if (nk) userAliases[nk] = v.trim();
          }
        }
      }
    } catch {
      userAliases = {};
    }
  }

  const arrayBuffer = await audioFile.arrayBuffer();
  const audioContent = Buffer.from(arrayBuffer);

  const client = getSpeechClient();
  if (!client) {
    return NextResponse.json(
      { error: "Google Cloud Speech-to-Text not configured" },
      { status: 503 }
    );
  }

  try {
    const phraseHintsForGoogle = expandPhraseHintsForGoogle(phrases).slice(0, 500);
    const phraseBoost =
      phraseHintsForGoogle.length > phrases.length ? 20 : phraseHintsForGoogle.length > 0 ? 12 : 0;
    const shortSyllableDeck =
      phrases.length > 0 &&
      phrases.every((p) => p.trim().length <= 8) &&
      phraseHintsForGoogle.length > phrases.length;

    const [response] = await client.recognize({
      config: {
        encoding: "WEBM_OPUS" as const,
        sampleRateHertz: 48000,
        languageCode: lang,
        ...(shortSyllableDeck ? { model: "command_and_search" as const } : {}),
        ...(phraseHintsForGoogle.length ? { maxAlternatives: 16 } : {}),
        speechContexts: phraseHintsForGoogle.length
          ? [{ phrases: phraseHintsForGoogle, boost: phraseBoost }]
          : [],
      },
      audio: { content: audioContent },
    });

    const orderedAlternatives: string[] = [];
    for (const r of response.results ?? []) {
      for (const a of r.alternatives ?? []) {
        const raw = a.transcript;
        const t = (typeof raw === "string" ? raw : raw != null ? String(raw) : "").trim();
        if (t) orderedAlternatives.push(t);
      }
    }

    const body = finalizeDeckSttFromAlternatives(
      orderedAlternatives,
      phrasesForResolve,
      userAliases
    );
    return NextResponse.json({
      ...body,
      provider: "google",
    });
  } catch (err) {
    console.error("Speech-to-Text error:", err);
    const msg = friendlyGoogleError(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
