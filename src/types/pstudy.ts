/** One study item (question/answer pair), matches desktop PSTUDY Item structure */
export interface PStudyItem {
  id: string;
  description: string;   // question / term
  explanation: string;   // answer
  multiplechoice1: string;
  multiplechoice2: string;
  multiplechoice3: string;
  multiplechoice4: string;
  picture_url: string;   // URL of image (if any)
  instruction: string;
  /** Optional flashcard hints; comma or semicolon separated (e.g. "past tense; irregular"). */
  keywords?: string;
}

/** A deck = one exercise file */
export interface Deck {
  id: string;
  title: string;
  items: PStudyItem[];
  /** Count of items; always set. List loads may set this from a count query without loading item rows. */
  itemCount: number;
  /**
   * When false, {@link items} is empty and only metadata was loaded (e.g. owned-deck list).
   * Use {@link itemCount} for display; call `fetchDeck(id)` for full content.
   */
  itemsLoaded: boolean;
  createdAt: string;
  updatedAt: string;
  isPublic?: boolean;
  ownerId?: string; // Only set when fetched from community (for display)
  /** Broad category for search (e.g. Geography, History, Science) */
  fieldOfInterest?: string | null;
  /** Specific sub-category (e.g. Europe, Middle Ages, French) */
  topic?: string | null;
  /**
   * Publication: draft (editable edition); checked (frozen, peer-verified); superseded (replaced by newer checked).
   */
  publicationStatus?: "draft" | "checked" | "verified" | "superseded";
  /**
   * Review workflow on current draft: none → submitted → revise_and_resubmit ↔ resubmitted until approved.
   */
  reviewStatus?: "none" | "submitted" | "revise_and_resubmit" | "resubmitted";
  /** Shared id for all revisions of one deck family */
  lineageId?: string;
  revisionNumber?: number;
  /**
   * Card languages for community filters: one code or two comma-separated (e.g. en / en,de), max two.
   * Codes: en, de, es, fr, it, nl, other. Null if unset.
   */
  contentLanguage?: string | null;
}

export type PracticeMode = "straight" | "multiple-choice";
export type OrderMode = "normal" | "random";
