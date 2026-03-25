/**
 * Supabase/PostgREST errors are plain objects, not Error instances.
 * Converting with String(err) yields "[object Object]" in toasts.
 */
export function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    const hint = (err as { hint?: unknown }).hint;
    const details = (err as { details?: unknown }).details;
    if (typeof m === "string" && m.length > 0) {
      const extra = [typeof hint === "string" ? hint : null, typeof details === "string" ? details : null]
        .filter(Boolean)
        .join(" — ");
      return extra ? new Error(`${m} (${extra})`) : new Error(m);
    }
  }
  if (typeof err === "string") return new Error(err);
  return new Error("Something went wrong");
}
