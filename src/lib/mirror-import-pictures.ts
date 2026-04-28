function supabaseProjectHost(): string | null {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!u) return null;
  try {
    return new URL(u).host;
  } catch {
    return null;
  }
}

/** Public URLs for files already in our Supabase `item-pictures` bucket. */
function isAlreadyItemPicturesStorage(pictureUrl: string, projectHost: string): boolean {
  try {
    const u = new URL(pictureUrl);
    if (u.hostname !== projectHost) return false;
    return u.pathname.includes("/item-pictures/");
  } catch {
    return false;
  }
}

export type MirrorPicturesResult<T> = { items: T[]; imageImportFailedCount: number };

/**
 * Fetches http(s) or data:image picture URLs in items and re-uploads each to
 * Supabase `item-pictures` (same as manual upload). Deduplicates identical URLs.
 * Skips blob: URLs, empty, and already-stored Supabase public URLs.
 * If a URL cannot be stored, that item’s `picture_url` is cleared and a warning is recorded (import still succeeds).
 */
export async function mirrorImportPicturesToSupabaseStorage<T extends { picture_url?: string }>(
  items: T[]
): Promise<MirrorPicturesResult<T>> {
  const host = supabaseProjectHost();
  if (!host) return { items, imageImportFailedCount: 0 };

  const toResolve = new Set<string>();
  for (const it of items) {
    const p = (it.picture_url ?? "").trim();
    if (!p) continue;
    if (p.startsWith("blob:")) continue;
    if (isAlreadyItemPicturesStorage(p, host)) continue;
    if (p.startsWith("data:image") || /^https?:\/\//i.test(p)) {
      toResolve.add(p);
    }
  }
  if (toResolve.size === 0) return { items, imageImportFailedCount: 0 };

  const originalToPublic = new Map<string, string>();
  const failedUrls = new Set<string>();

  for (const raw of toResolve) {
    try {
      const res = await fetch("/api/item-pictures/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          raw.startsWith("data:") ? { dataUrl: raw } : { url: raw }
        ),
      });
      const j = (await res.json()) as { publicUrl?: string; error?: string };
      if (!res.ok) {
        throw new Error(j.error ?? `Image could not be stored (${res.status})`);
      }
      if (!j.publicUrl) {
        throw new Error("Image import returned no URL");
      }
      originalToPublic.set(raw, j.publicUrl);
    } catch (e) {
      failedUrls.add(raw);
    }
  }

  const out = items.map((it) => {
    const p = (it.picture_url ?? "").trim();
    if (failedUrls.has(p)) {
      return { ...it, picture_url: "" };
    }
    if (!p || !originalToPublic.has(p)) return it;
    return { ...it, picture_url: originalToPublic.get(p)! };
  });
  return { items: out, imageImportFailedCount: failedUrls.size };
}
