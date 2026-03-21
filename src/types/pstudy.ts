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
}

/** A deck = one exercise file */
export interface Deck {
  id: string;
  title: string;
  items: PStudyItem[];
  createdAt: string;
  updatedAt: string;
  isPublic?: boolean;
  ownerId?: string; // Only set when fetched from community (for display)
  /** Broad category for search (e.g. Geography, History, Science) */
  fieldOfInterest?: string | null;
  /** Specific sub-category (e.g. Europe, Middle Ages, French) */
  topic?: string | null;
}

export type PracticeMode = "straight" | "multiple-choice";
export type OrderMode = "normal" | "random";
