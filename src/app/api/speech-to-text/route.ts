/**
 * Google Cloud Speech-to-Text API route.
 * Receives audio (WebM/Opus), returns transcript with phrase hints for better accuracy.
 */

import { NextRequest, NextResponse } from "next/server";
import speech from "@google-cloud/speech";

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
    const lang = (formData.get("lang") as string) || "en-US";

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
    // Google limits phrase hints; use first 500
    const phraseHints = phrases.slice(0, 500);

    const arrayBuffer = await audioFile.arrayBuffer();
    const audioContent = Buffer.from(arrayBuffer);

    const [response] = await client.recognize({
      config: {
        encoding: "WEBM_OPUS" as const,
        sampleRateHertz: 48000, // Opus often 48kHz
        languageCode: lang && lang.length >= 2 ? lang : "en-US",
        speechContexts: phraseHints.length
          ? [{ phrases: phraseHints, boost: 20 }]
          : [],
      },
      audio: { content: audioContent },
    });

    const transcript =
      response.results
        ?.map((r) => r.alternatives?.[0]?.transcript)
        .filter(Boolean)
        .join(" ")
        .trim() ?? "";

    return NextResponse.json({ transcript });
  } catch (err) {
    console.error("Speech-to-Text error:", err);
    const msg = err instanceof Error ? err.message : "Speech recognition failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
