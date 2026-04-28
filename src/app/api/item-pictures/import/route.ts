import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "item-pictures";
const MAX_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 25_000;

/** Wikimedia and many CDNs block bare server/bot fetches; match a real browser + Commons referer. */
const IMAGE_FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://commons.wikimedia.org/",
};

function sniffImageMimeFromBuffer(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  if (buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "image/webp";
  if (buf[0] === 0x42 && buf[1] === 0x4d) return "image/bmp";
  const head = buf.subarray(0, Math.min(256, buf.length)).toString("utf8").trimStart();
  if (head.startsWith("<svg") || head.startsWith("<?xml")) return "image/svg+xml";
  return null;
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "::1" || h.endsWith(".localhost") || h.endsWith(".local"))
    return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

function assertPublicHttpUrl(u: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    throw new Error("Invalid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http(s) image URLs are allowed");
  }
  if (isPrivateOrLocalHost(parsed.hostname)) {
    throw new Error("This URL is not allowed for import");
  }
  return parsed;
}

function extFromMime(mime: string): string {
  const m = mime.split(";")[0]!.trim().toLowerCase();
  if (m === "image/jpeg" || m === "image/jpg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/gif") return "gif";
  if (m === "image/webp") return "webp";
  if (m === "image/svg+xml") return "svg";
  if (m === "image/bmp") return "bmp";
  return "img";
}

function parseDataImageUrl(dataUrl: string): { data: Buffer; mime: string } {
  const m = /^data:(image\/[a-z0-9.+\-]+);base64,(.*)$/i.exec(dataUrl.replace(/\s/g, ""));
  if (!m) throw new Error("Invalid data:image URL");
  const mime = m[1]!;
  const b64 = m[2] ?? "";
  const data = Buffer.from(b64, "base64");
  if (data.length > MAX_BYTES) throw new Error("Image is too large (max 5 MB)");
  if (data.length === 0) throw new Error("Empty image data");
  return { data, mime };
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return bad("Not logged in", 401);

  let body: { url?: string; dataUrl?: string };
  try {
    body = (await req.json()) as { url?: string; dataUrl?: string };
  } catch {
    return bad("Invalid JSON", 400);
  }

  const hasUrl = typeof body.url === "string" && body.url.trim().length > 0;
  const hasData = typeof body.dataUrl === "string" && body.dataUrl.trim().length > 0;
  if (hasUrl === hasData) {
    return bad("Send exactly one of: url, dataUrl", 400);
  }

  let imageBytes: Buffer;
  let contentType: string;

  if (hasUrl) {
    const urlStr = body.url!.trim();
    try {
      assertPublicHttpUrl(urlStr);
    } catch (e) {
      return bad(e instanceof Error ? e.message : "Invalid URL", 400);
    }

    const tryFetch = (headers: Record<string, string>) =>
      fetch(urlStr, {
        redirect: "follow",
        headers,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

    let res: Response;
    try {
      res = await tryFetch(IMAGE_FETCH_HEADERS);
      if (!res.ok) {
        const noReferer: Record<string, string> = { ...IMAGE_FETCH_HEADERS };
        delete noReferer.Referer;
        res = await tryFetch(noReferer);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error";
      return bad(`Could not download image: ${msg}`, 502);
    }
    if (!res.ok) {
      return bad(
        `Could not download image (HTTP ${res.status}). The host may block automated downloads; try a different image URL or add the picture manually in the deck editor.`,
        502
      );
    }
    const ab = await res.arrayBuffer();
    if (ab.byteLength > MAX_BYTES) {
      return bad("Image is too large (max 5 MB)", 400);
    }
    if (ab.byteLength === 0) {
      return bad("Empty image", 400);
    }
    imageBytes = Buffer.from(ab);
    const headerCt = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    const sniffed = sniffImageMimeFromBuffer(imageBytes);
    if (headerCt.startsWith("image/")) {
      contentType = headerCt;
    } else if (sniffed) {
      contentType = sniffed;
    } else {
      return bad(
        "URL did not return image data (wrong content type or not an image). Check the address or add the picture manually in the editor.",
        400
      );
    }
  } else {
    try {
      const p = parseDataImageUrl(body.dataUrl!);
      imageBytes = p.data;
      contentType = p.mime;
    } catch (e) {
      return bad(e instanceof Error ? e.message : "Invalid data URL", 400);
    }
  }

  const ext = extFromMime(contentType);
  const objectPath = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const blob = new Blob([new Uint8Array(imageBytes)], { type: contentType });
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(objectPath, blob, {
    cacheControl: "3600",
    upsert: false,
    contentType,
  });
  if (upErr) {
    return bad(upErr.message || "Storage upload failed", 500);
  }

  const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return NextResponse.json({ publicUrl: publicData.publicUrl });
}
