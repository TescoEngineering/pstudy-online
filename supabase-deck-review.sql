-- PSTUDY: deck quality (draft / checked) + peer review invites
-- Run in Supabase SQL Editor after base tables exist.

ALTER TABLE decks ADD COLUMN IF NOT EXISTS quality_status TEXT NOT NULL DEFAULT 'draft';

ALTER TABLE decks DROP CONSTRAINT IF EXISTS decks_quality_status_check;
ALTER TABLE decks ADD CONSTRAINT decks_quality_status_check
  CHECK (quality_status IN ('draft', 'checked'));

-- Optional (run once): mark decks that were already public before this feature as checked
-- UPDATE decks SET quality_status = 'checked' WHERE is_public = true AND quality_status = 'draft';

CREATE TABLE IF NOT EXISTS deck_review_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewer_email TEXT NOT NULL,
  access_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  reviewer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_deck_review_deck ON deck_review_invites(deck_id);
CREATE INDEX IF NOT EXISTS idx_deck_review_token ON deck_review_invites(access_token);
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_review_per_deck
  ON deck_review_invites(deck_id) WHERE status = 'pending';

ALTER TABLE deck_review_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage deck review invites" ON deck_review_invites;
CREATE POLICY "Owners manage deck review invites"
  ON deck_review_invites FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Reviewers read invites for their email" ON deck_review_invites;
CREATE POLICY "Reviewers read invites for their email"
  ON deck_review_invites FOR SELECT
  TO authenticated
  USING (
    lower(trim(reviewer_email)) = lower(trim(auth.jwt() ->> 'email'))
  );
