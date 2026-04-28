-- PSTUDY: add global "verified" publication status + audit trail for status changes
-- Run AFTER publication-review.sql (it adds publication_status + constraints).

-- ---------------------------------------------------------------------------
-- 1) Extend publication_status enum-like constraint
-- ---------------------------------------------------------------------------

ALTER TABLE decks DROP CONSTRAINT IF EXISTS decks_publication_status_check;
ALTER TABLE decks ADD CONSTRAINT decks_publication_status_check
  CHECK (publication_status IN ('draft', 'checked', 'verified', 'superseded'));

COMMENT ON COLUMN decks.publication_status IS 'draft | checked | verified | superseded (per revision row)';

-- ---------------------------------------------------------------------------
-- 2) Audit log: append-only events per deck lineage revision row
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS deck_publication_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_email TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'system',
  source_id UUID,
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_deck_pub_events_deck ON deck_publication_events(deck_id, changed_at DESC);

ALTER TABLE deck_publication_events DROP CONSTRAINT IF EXISTS deck_pub_events_to_status_check;
ALTER TABLE deck_publication_events ADD CONSTRAINT deck_pub_events_to_status_check
  CHECK (to_status IN ('draft', 'checked', 'verified', 'superseded'));

ALTER TABLE deck_publication_events DROP CONSTRAINT IF EXISTS deck_pub_events_from_status_check;
ALTER TABLE deck_publication_events ADD CONSTRAINT deck_pub_events_from_status_check
  CHECK (from_status IS NULL OR from_status IN ('draft', 'checked', 'verified', 'superseded'));

COMMENT ON TABLE deck_publication_events IS 'Append-only status transitions for decks (audit trail).';
COMMENT ON COLUMN deck_publication_events.source IS 'system | owner | peer_review | teacher_verify';

-- ---------------------------------------------------------------------------
-- 3) RLS: allow users to view events for decks they own OR public decks
-- Inserts are done via service role / admin API.
-- ---------------------------------------------------------------------------

ALTER TABLE deck_publication_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pub_events_select_owner_or_public" ON deck_publication_events;
CREATE POLICY "pub_events_select_owner_or_public"
  ON deck_publication_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM decks d
      WHERE d.id = deck_publication_events.deck_id
        AND (d.owner_id = auth.uid() OR d.is_public = TRUE)
    )
  );

DROP POLICY IF EXISTS "pub_events_insert_none" ON deck_publication_events;
CREATE POLICY "pub_events_insert_none"
  ON deck_publication_events
  FOR INSERT
  TO authenticated
  WITH CHECK (FALSE);

DROP POLICY IF EXISTS "pub_events_update_none" ON deck_publication_events;
CREATE POLICY "pub_events_update_none"
  ON deck_publication_events
  FOR UPDATE
  TO authenticated
  USING (FALSE);

DROP POLICY IF EXISTS "pub_events_delete_none" ON deck_publication_events;
CREATE POLICY "pub_events_delete_none"
  ON deck_publication_events
  FOR DELETE
  TO authenticated
  USING (FALSE);

-- ---------------------------------------------------------------------------
-- 4) Backfill: create initial "draft created" events if missing
-- ---------------------------------------------------------------------------

INSERT INTO deck_publication_events (deck_id, from_status, to_status, changed_by, changed_at, source, note)
SELECT d.id, NULL, 'draft', d.owner_id, d.created_at, 'owner', 'initial backfill'
FROM decks d
WHERE NOT EXISTS (
  SELECT 1 FROM deck_publication_events e WHERE e.deck_id = d.id
);

