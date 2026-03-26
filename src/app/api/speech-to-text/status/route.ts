/**
 * Check if Google Cloud Speech-to-Text is configured.
 * Used by the client to decide whether to use cloud or Web Speech API.
 */

import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const jsonRaw = process.env.GOOGLE_CLOUD_CREDENTIALS_JSON;
  if (jsonRaw) {
    try {
      JSON.parse(jsonRaw);
      return NextResponse.json({
        available: true,
        source: "env_json",
      });
    } catch {
      return NextResponse.json({
        available: false,
        source: "env_json",
        hint: "GOOGLE_CLOUD_CREDENTIALS_JSON is set but is not valid JSON. Paste the full service account key.",
      });
    }
  }

  const fileEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (fileEnv) {
    const candidates = [
      fileEnv,
      path.resolve(process.cwd(), fileEnv),
    ];
    const found = candidates.some((p) => fs.existsSync(p));
    return NextResponse.json({
      available: found,
      source: "credentials_file",
      ...(found
        ? {}
        : {
            hint:
              "GOOGLE_APPLICATION_CREDENTIALS points to a file that was not found. Use a path relative to the project root (e.g. ./google-credentials.json) or an absolute path.",
          }),
    });
  }

  return NextResponse.json({
    available: false,
    source: "none",
    hint: "Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_CLOUD_CREDENTIALS_JSON. See GOOGLE-CLOUD-SETUP.md",
  });
}
