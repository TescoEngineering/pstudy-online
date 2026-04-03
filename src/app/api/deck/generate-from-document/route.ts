import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildSystemPrompt,
  buildUserPrompt,
  parseGeneratedPayload,
  rawToStudyItems,
  truncateDocument,
  type GenerateOutputMode,
} from "@/lib/ai-deck-generate";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function callOpenAIJson(messages: { role: "system" | "user"; content: string }[]): Promise<string> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error("OPENAI_API_KEY_MISSING");
  }
  const model = (process.env.OPENAI_MODEL ?? "gpt-4o-mini").trim();

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.35,
      response_format: { type: "json_object" },
      max_completion_tokens: 8192,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`OPENAI_HTTP_${res.status}:${errBody.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("OPENAI_EMPTY_RESPONSE");
  }
  return content.trim();
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return bad("Not logged in", 401);

  const body = (await request.json().catch(() => null)) as {
    documentText?: string;
    outputMode?: string;
    flashcardCount?: number;
    multipleChoiceCount?: number;
    deckTitle?: string;
  } | null;

  const rawText = typeof body?.documentText === "string" ? body.documentText : "";
  if (!rawText.trim()) return bad("documentText is required");

  const outputMode = body?.outputMode as GenerateOutputMode | undefined;
  if (
    outputMode !== "flashcards" &&
    outputMode !== "multiple_choice" &&
    outputMode !== "both"
  ) {
    return bad('outputMode must be "flashcards", "multiple_choice", or "both"');
  }

  const flashcardCount =
    typeof body?.flashcardCount === "number" && Number.isFinite(body.flashcardCount)
      ? Math.floor(body.flashcardCount)
      : 12;
  const multipleChoiceCount =
    typeof body?.multipleChoiceCount === "number" && Number.isFinite(body.multipleChoiceCount)
      ? Math.floor(body.multipleChoiceCount)
      : 10;

  const { text: documentText, truncated } = truncateDocument(rawText);

  let jsonText: string;
  try {
    jsonText = await callOpenAIJson([
      { role: "system", content: buildSystemPrompt() },
      {
        role: "user",
        content: buildUserPrompt(documentText, outputMode, flashcardCount, multipleChoiceCount),
      },
    ]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "OPENAI_API_KEY_MISSING") {
      return NextResponse.json(
        { error: "AI generation is not configured (missing OPENAI_API_KEY on the server)." },
        { status: 503 }
      );
    }
    if (msg.startsWith("OPENAI_HTTP_")) {
      return bad("The AI service returned an error. Try a shorter document or try again later.", 502);
    }
    return bad(msg, 502);
  }

  let rawPayload: ReturnType<typeof parseGeneratedPayload>;
  try {
    rawPayload = parseGeneratedPayload(jsonText);
  } catch {
    return bad("Could not parse AI response. Try again.", 502);
  }

  const items = rawToStudyItems(rawPayload, outputMode);
  if (items.length === 0) {
    return bad("The model did not return any usable items. Try different settings or a richer document.");
  }

  const deckTitle =
    typeof body?.deckTitle === "string" && body.deckTitle.trim()
      ? body.deckTitle.trim().slice(0, 200)
      : `Generated: ${documentText.split(/\s+/).slice(0, 6).join(" ").slice(0, 80)}${documentText.length > 60 ? "…" : ""}`;

  return NextResponse.json({
    items,
    deckTitle,
    meta: { truncated, outputMode },
  });
}
