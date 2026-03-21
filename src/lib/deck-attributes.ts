/**
 * Deck attributes for search and discovery.
 * Field of Interest = broad category; Topic = specific sub-category.
 */

export const FIELDS_OF_INTEREST = [
  "Geography",
  "History",
  "Science",
  "Music",
  "Languages",
  "Professional",
  "Sports",
  "Hobbys",
  "Construction",
  "Nature",
  "Other",
] as const;

export type FieldOfInterest = (typeof FIELDS_OF_INTEREST)[number];

/** Topics per field of interest */
export const TOPICS_BY_FIELD: Record<FieldOfInterest, readonly string[]> = {
  Geography: ["Europe", "Africa", "Asia", "Americas", "Oceania", "World", "Other"],
  History: ["Prehistoric", "Middle Ages", "Ancient", "Modern", "World Wars", "Other"],
  Science: ["Medical sciences", "Physics", "Mathematics", "Biology", "Chemistry", "Earth & Space", "Other"],
  Music: ["Classical", "Jazz", "Pop", "Rock", "Folk", "Other"],
  Languages: ["French", "English", "Spanish", "German", "Dutch", "Italian", "Other"],
  Professional: ["Business", "Law", "Medicine", "Engineering", "IT", "Finance", "EHS", "Other"],
  Sports: ["Football", "Tennis", "Cycling", "Swimming", "Running", "Other"],
  Hobbys: ["Crafts", "Gardening", "Photography", "Collecting", "Cooking", "Other"],
  Construction: ["Architecture", "Building", "Civil", "Renovation", "Other"],
  Nature: ["Wildlife", "Plants", "Environment", "Outdoor", "Other"],
  Other: ["General", "Other"],
};

export function getTopicsForField(field: FieldOfInterest | string | null | undefined): string[] {
  if (!field || field === "Other") return [...TOPICS_BY_FIELD.Other];
  if (field in TOPICS_BY_FIELD) return [...TOPICS_BY_FIELD[field as FieldOfInterest]];
  return [...TOPICS_BY_FIELD.Other];
}

/** All unique topics across all fields (for filter when no field selected) */
export function getAllTopics(): string[] {
  const seen = new Set<string>();
  for (const topics of Object.values(TOPICS_BY_FIELD)) {
    for (const t of topics) {
      if (t !== "Other") seen.add(t);
    }
  }
  return Array.from(seen).sort();
}
