import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildSystemPrompt,
  buildUserPrompt,
  maybeCapAiGeneratedItems,
  clampMcWrongOptionCount,
  normalizeDeckGenerationLanguage,
  parseGeneratedPayload,
  rawToStudyItems,
  truncateDocument,
  type GenerateOutputMode,
} from "@/lib/ai-deck-generate";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function openAiMessageFromBody(errBody: string): string {
  try {
    const j = JSON.parse(errBody) as { error?: { message?: string } };
    const m = j.error?.message?.trim();
    if (m) return m.length > 280 ? `${m.slice(0, 277)}…` : m;
  } catch {
    /* ignore */
  }
  return "";
}

async function callOpenAIJson(messages: { role: "system" | "user"; content: string }[]): Promise<string> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error("OPENAI_API_KEY_MISSING");
  }
  /**
   * Default: GPT-5.4 mini (faster / cheaper than full GPT-5.4, stronger 5.x family — see https://platform.openai.com/docs/models/gpt-5.4-mini).
   * Override OPENAI_MODEL for max quality (e.g. gpt-5.4) or if your org does not have 5.x yet (e.g. gpt-4o-mini).
   */
  const model = (process.env.OPENAI_MODEL ?? "gpt-5.4-mini").trim();

  const url = "https://api.openai.com/v1/chat/completions";
  const headers = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };

  /** Avoid max_* caps: wrong names or sizes cause 400 on some models/billing tiers. */
  const bodyWithJsonMode = JSON.stringify({
    model,
    messages,
    temperature: 0.25,
    response_format: { type: "json_object" },
  });

  let res = await fetch(url, { method: "POST", headers, body: bodyWithJsonMode });

  if (!res.ok && res.status === 400) {
    const errText = await res.text();
    const hint = openAiMessageFromBody(errText);
    const retryWithoutJsonMode =
      /response_format|json_object|json mode/i.test(hint) || hint.length === 0;
    if (retryWithoutJsonMode) {
      res = await fetch(
        url,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.25,
          }),
        }
      );
    } else {
      throw new Error(
        `OPENAI_HTTP_${res.status}:${hint || errText.slice(0, 200)}`
      );
    }
  }

  if (!res.ok) {
    const errBody = await res.text();
    const hint = openAiMessageFromBody(errBody);
    throw new Error(`OPENAI_HTTP_${res.status}:${hint || errBody.slice(0, 200)}`);
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
    mcWrongOptionCount?: unknown;
    deckTitle?: string;
    deckLanguage?: unknown;
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

  const mcWrongOptionCount = clampMcWrongOptionCount(body?.mcWrongOptionCount);
  const deckLanguage = normalizeDeckGenerationLanguage(body?.deckLanguage);

  const { text: documentText, truncated } = truncateDocument(rawText);

  let jsonText: string;
  try {
    jsonText = await callOpenAIJson([
      { role: "system", content: buildSystemPrompt(deckLanguage) },
      {
        role: "user",
        content: buildUserPrompt(
          documentText,
          outputMode,
          flashcardCount,
          multipleChoiceCount,
          mcWrongOptionCount
        ),
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
      const detail = msg.includes(":") ? msg.slice(msg.indexOf(":") + 1) : "";
      return bad(
        detail
          ? `AI service: ${detail}`
          : "The AI service returned an error. Check billing and API key, or try a shorter document.",
        502
      );
    }
    return bad(msg, 502);
  }

  let rawPayload: ReturnType<typeof parseGeneratedPayload>;
  try {
    rawPayload = parseGeneratedPayload(jsonText);
  } catch {
    return bad("Could not parse AI response. Try again.", 502);
  }

  const parsedItems = rawToStudyItems(rawPayload, outputMode, mcWrongOptionCount);
  const items = maybeCapAiGeneratedItems(parsedItems, outputMode, flashcardCount, multipleChoiceCount);
  const extraItemsDropped = Math.max(0, parsedItems.length - items.length);
  if (items.length === 0) {
    return bad("The model did not return any usable items. Try different settings or a richer document.");
  }

  const deckTitle =
    typeof body?.deckTitle === "string" && body.deckTitle.trim()
      ? body.deckTitle.trim().slice(0, 200)
      : `Generated: ${documentText.split(/\s+/).slice(0, 6).join(" ").slice(0, 80)}${documentText.length > 60 ? "…" : ""}`;

  return NextResponse.json({
    items,
    ...(extraItemsDropped > 0 ? { itemsFull: parsedItems } : {}),
    deckTitle,
    meta: {
      truncated,
      outputMode,
      mcWrongOptionCount,
      deckLanguage,
      extraItemsDropped,
    },
  });
}
