/** Publication + review state (trust / quality workflow). */

export type PublicationStatus = "draft" | "checked" | "superseded";
export type ReviewStatus = "none" | "submitted" | "revise_and_resubmit" | "resubmitted";

export function normalizePublicationStatus(raw: string | null | undefined): PublicationStatus {
  if (raw === "checked" || raw === "superseded" || raw === "draft") return raw;
  return "draft";
}

export function normalizeReviewStatus(raw: string | null | undefined): ReviewStatus {
  if (
    raw === "none" ||
    raw === "submitted" ||
    raw === "revise_and_resubmit" ||
    raw === "resubmitted"
  ) {
    return raw;
  }
  return "none";
}

/** Deck row shape for community picker (minimal fields). */
export type CommunityDeckRow = {
  id: string;
  is_public?: boolean | null;
  publication_status?: string | null;
  review_status?: string | null;
  lineage_id?: string | null;
  revision_number?: number | null;
};

/**
 * One representative public deck per lineage for Community:
 * — if any Checked exists → highest revision_number among Checked
 * — else → highest revision_number among Draft (first-time public draft with badge)
 */
export function pickCommunityRepresentativeRows<T extends CommunityDeckRow>(rows: T[]): T[] {
  const publicRows = rows.filter((r) => r.is_public);
  const byLineage = new Map<string, T[]>();
  for (const r of publicRows) {
    const lid = r.lineage_id ?? r.id;
    const arr = byLineage.get(lid) ?? [];
    arr.push(r);
    byLineage.set(lid, arr);
  }
  const out: T[] = [];
  for (const arr of byLineage.values()) {
    const checked = arr
      .filter((d) => normalizePublicationStatus(d.publication_status) === "checked")
      .sort((a, b) => (b.revision_number ?? 0) - (a.revision_number ?? 0));
    if (checked.length > 0) {
      out.push(checked[0]!);
      continue;
    }
    const drafts = arr
      .filter((d) => normalizePublicationStatus(d.publication_status) === "draft")
      .sort((a, b) => (b.revision_number ?? 0) - (a.revision_number ?? 0));
    if (drafts.length > 0) {
      out.push(drafts[0]!);
    }
  }
  return out;
}

export function deckIsReadOnlyPublication(pub: PublicationStatus): boolean {
  return pub === "checked" || pub === "superseded";
}
