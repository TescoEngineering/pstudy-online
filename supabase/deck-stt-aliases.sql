-- PSTUDY: per-user, per-deck-lineage STT → answer mappings (sync across devices)
-- Run AFTER base schema + publication-review.sql (decks must exist).

CREATE TABLE IF NOT EXISTS deck_stt_aliases (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lineage_id UUID NOT NULL,
  aliases JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, lineage_id)
);

CREATE INDEX IF NOT EXISTS idx_deck_stt_aliases_user ON deck_stt_aliases(user_id);

COMMENT ON TABLE deck_stt_aliases IS 'Per-user STT alias mappings keyed by deck lineage_id; stored for cross-device sync.';
COMMENT ON COLUMN deck_stt_aliases.aliases IS 'JSON object mapping normalized heard phrase -> deck answer string.';

ALTER TABLE deck_stt_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deck_stt_aliases_select_own" ON deck_stt_aliases;
CREATE POLICY "deck_stt_aliases_select_own"
  ON deck_stt_aliases
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "deck_stt_aliases_upsert_own" ON deck_stt_aliases;
CREATE POLICY "deck_stt_aliases_upsert_own"
  ON deck_stt_aliases
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "deck_stt_aliases_update_own" ON deck_stt_aliases;
CREATE POLICY "deck_stt_aliases_update_own"
  ON deck_stt_aliases
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- (Optional) disallow deletes for safety (can be enabled later if needed).
DROP POLICY IF EXISTS "deck_stt_aliases_delete_none" ON deck_stt_aliases;
CREATE POLICY "deck_stt_aliases_delete_none"
  ON deck_stt_aliases
  FOR DELETE
  TO authenticated
  USING (FALSE);

