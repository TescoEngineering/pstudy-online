import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getClassificationStringsToModerate,
  isClassificationValueLengthValid,
} from "@/lib/deck-classification-validate";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message, ok: false as const }, { status });
}

/**
 * OpenAI moderations: flags sexual, violence, hate, self-harm, etc.
 * See https://platform.openai.com/docs/guides/moderation
 */
async function moderateWithOpenAI(texts: string[]): Promise<{ flagged: boolean }> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return { flagged: false };
  }
  if (texts.length === 0) return { flagged: false };

  const res = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-moderation-latest",
      input: texts,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`MODERATION_HTTP_${res.status}:${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    results?: { flagged?: boolean }[];
  };
  const results = data.results ?? [];
  const flagged = results.some((r) => r.flagged === true);
  return { flagged };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return bad("Not logged in", 401);

  const body = (await request.json().catch(() => null)) as {
    fieldOfInterest?: string | null;
    topic?: string | null;
  } | null;

  const fieldRaw = body?.fieldOfInterest;
  const topicRaw = body?.topic;
  const field =
    typeof fieldRaw === "string" || fieldRaw === null ? fieldRaw : undefined;
  const topic = typeof topicRaw === "string" || topicRaw === null ? topicRaw : undefined;
  if (field === undefined || topic === undefined) {
    return bad("fieldOfInterest and topic are required (use null to clear).");
  }

  if (!isClassificationValueLengthValid(field ?? "") || !isClassificationValueLengthValid(topic ?? "")) {
    return bad("Field or topic is too long.", 400);
  }

  const f = field === null || field === "" ? null : String(field).trim() || null;
  const t = topic === null || topic === "" ? null : String(topic).trim() || null;

  const toModerate = getClassificationStringsToModerate(f, t);
  if (toModerate.length === 0) {
    return NextResponse.json({ ok: true as const, moderated: false as const });
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json({ ok: true as const, moderated: false as const, skipped: true as const });
  }

  try {
    const { flagged } = await moderateWithOpenAI(toModerate);
    if (flagged) {
      return NextResponse.json(
        { ok: false as const, error: "moderation_flagged" as const },
        { status: 422 }
      );
    }
    return NextResponse.json({ ok: true as const, moderated: true as const });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("MODERATION_HTTP_")) {
      return NextResponse.json(
        { ok: false as const, error: "moderation_unavailable" as const },
        { status: 503 }
      );
    }
    return bad("Moderation failed.", 500);
  }
}
