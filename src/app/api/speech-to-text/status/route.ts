/**
 * Check if Google Cloud Speech-to-Text is configured.
 * Used by the client to decide whether to use cloud or Web Speech API.
 */

import { NextResponse } from "next/server";

function isConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CLOUD_CREDENTIALS_JSON ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS
  );
}

export async function GET() {
  return NextResponse.json({ available: isConfigured() });
}
