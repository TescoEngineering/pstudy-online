-- Optional: run once in Supabase SQL Editor if your `items` table was created without `keywords`.
-- Flashcard hints: comma- or semicolon-separated tags shown on the flashcard (optional).

ALTER TABLE items
ADD COLUMN IF NOT EXISTS keywords TEXT DEFAULT '';
