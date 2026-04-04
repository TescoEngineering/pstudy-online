-- PSTUDY: publication (draft / checked / superseded) + review workflow states + lineage revisions
-- Run in Supabase SQL Editor after deck-content-language / deck-review migrations.

-- 1) New columns (keep quality_status until backfill, then drop)
ALTER TABLE decks ADD COLUMN IF NOT EXISTS publication_status TEXT;
ALTER TABLE decks ADD COLUMN IF NOT EXISTS review_status TEXT;
ALTER TABLE decks ADD COLUMN IF NOT EXISTS lineage_id UUID;
ALTER TABLE decks ADD COLUMN IF NOT EXISTS revision_number INT;

-- 2) Backfill from legacy quality_status if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'decks' AND column_name = 'quality_status'
  ) THEN
    UPDATE decks
    SET publication_status = quality_status
    WHERE publication_status IS NULL
      AND quality_status IN ('draft', 'checked');
  END IF;
END $$;

UPDATE decks SET publication_status = 'draft' WHERE publication_status IS NULL;

UPDATE decks SET review_status = 'none' WHERE review_status IS NULL;
UPDATE decks SET revision_number = 1 WHERE revision_number IS NULL;
UPDATE decks SET lineage_id = id WHERE lineage_id IS NULL;

ALTER TABLE decks ALTER COLUMN publication_status SET DEFAULT 'draft';
ALTER TABLE decks ALTER COLUMN publication_status SET NOT NULL;
ALTER TABLE decks ALTER COLUMN review_status SET DEFAULT 'none';
ALTER TABLE decks ALTER COLUMN review_status SET NOT NULL;
ALTER TABLE decks ALTER COLUMN revision_number SET NOT NULL;
ALTER TABLE decks ALTER COLUMN lineage_id SET NOT NULL;

ALTER TABLE decks DROP CONSTRAINT IF EXISTS decks_publication_status_check;
ALTER TABLE decks ADD CONSTRAINT decks_publication_status_check
  CHECK (publication_status IN ('draft', 'checked', 'superseded'));

ALTER TABLE decks DROP CONSTRAINT IF EXISTS decks_review_status_check;
ALTER TABLE decks ADD CONSTRAINT decks_review_status_check
  CHECK (review_status IN ('none', 'submitted', 'revise_and_resubmit', 'resubmitted'));

-- 3) Remove legacy column
ALTER TABLE decks DROP CONSTRAINT IF EXISTS decks_quality_status_check;
ALTER TABLE decks DROP COLUMN IF EXISTS quality_status;

-- 4) Reviewer feedback on invite (optional note when requesting changes)
ALTER TABLE deck_review_invites ADD COLUMN IF NOT EXISTS feedback_note TEXT;

COMMENT ON COLUMN decks.publication_status IS 'draft | checked | superseded (per revision row)';
COMMENT ON COLUMN decks.review_status IS 'none | submitted | revise_and_resubmit | resubmitted (draft only)';
COMMENT ON COLUMN decks.lineage_id IS 'Stable id shared by all revisions of one deck family';
COMMENT ON COLUMN decks.revision_number IS 'Monotonic per lineage (1, 2, …)';
