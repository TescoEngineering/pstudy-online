/**
 * Client-side helpers for downloading a deck as PSTUDY .txt (see {@link buildPStudyTxtFileContents}).
 */

export function sanitizeDeckExportBasename(title: string): string {
  const base = (title.trim() || "pstudy-deck").slice(0, 120);
  return (
    base
      .replace(/[/\\?%*:|"<>]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "pstudy-deck"
  );
}

export function downloadTextFile(basename: string, content: string): void {
  if (typeof window === "undefined") return;
  const name = basename.toLowerCase().endsWith(".txt") ? basename : `${basename}.txt`;
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
