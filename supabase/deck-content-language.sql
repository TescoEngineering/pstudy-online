-- Deck primary language for community browsing (ISO-style codes). Run in Supabase SQL Editor.
-- Nullable = author did not specify; community filters can hide or include these separately.

ALTER TABLE decks ADD COLUMN IF NOT EXISTS content_language TEXT;

COMMENT ON COLUMN decks.content_language IS 'Card languages: one ISO-style code or two comma-separated (en, de, es, fr, it, nl, other), max two; null if unspecified.';
