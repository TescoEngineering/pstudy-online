/**
 * Report whether Google Cloud Speech-to-Text is configured.
 */

import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function googleConfigured(): boolean {
  const jsonRaw = process.env.GOOGLE_CLOUD_CREDENTIALS_JSON;
  if (jsonRaw) {
    try {
      JSON.parse(jsonRaw);
      return true;
    } catch {
      return false;
    }
  }
  const fileEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!fileEnv) return false;
  const candidates = [fileEnv, path.resolve(process.cwd(), fileEnv)];
  return candidates.some((p) => fs.existsSync(p));
}

export async function GET() {
  const google = googleConfigured();

  const googleHint = google
    ? {}
    : {
        googleHint:
          "Google: set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_CLOUD_CREDENTIALS_JSON (see GOOGLE-CLOUD-SETUP.md).",
      };

  return NextResponse.json({
    available: google,
    google,
    ...googleHint,
  });
}
