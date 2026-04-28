-- PSTUDY: exam assignments & invites (run in Supabase SQL Editor after main schema)
-- Author creates an exam from a deck; invites hold magic-link tokens for examinees.

CREATE TABLE IF NOT EXISTS exam_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 24 * 60),
  prompt_mode TEXT NOT NULL CHECK (prompt_mode IN ('description', 'explanation')) DEFAULT 'description',
  exam_type TEXT NOT NULL CHECK (exam_type IN ('multiple-choice', 'straight-answer')) DEFAULT 'multiple-choice',
  grading_mode TEXT NOT NULL CHECK (grading_mode IN ('exact-match', 'lenient-match')) DEFAULT 'lenient-match',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE exam_assignments
  ADD COLUMN IF NOT EXISTS exam_type TEXT NOT NULL DEFAULT 'multiple-choice';
ALTER TABLE exam_assignments
  ADD COLUMN IF NOT EXISTS grading_mode TEXT NOT NULL DEFAULT 'lenient-match';

ALTER TABLE exam_assignments DROP CONSTRAINT IF EXISTS exam_assignments_exam_type_check;
ALTER TABLE exam_assignments
  ADD CONSTRAINT exam_assignments_exam_type_check
  CHECK (exam_type IN ('multiple-choice', 'straight-answer'));

ALTER TABLE exam_assignments DROP CONSTRAINT IF EXISTS exam_assignments_grading_mode_check;
ALTER TABLE exam_assignments
  ADD CONSTRAINT exam_assignments_grading_mode_check
  CHECK (grading_mode IN ('exact-match', 'lenient-match'));

CREATE INDEX IF NOT EXISTS idx_exam_assignments_owner ON exam_assignments(owner_id);
CREATE INDEX IF NOT EXISTS idx_exam_assignments_deck ON exam_assignments(deck_id);

ALTER TABLE exam_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage own exam assignments" ON exam_assignments;
CREATE POLICY "Owners manage own exam assignments"
  ON exam_assignments FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (
      SELECT 1 FROM decks d
      WHERE d.id = deck_id AND d.owner_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS exam_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES exam_assignments(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  access_token TEXT NOT NULL UNIQUE,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (assignment_id, email)
);

-- When exam_invites already exists (from a previous run), ensure the column exists.
ALTER TABLE exam_invites
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_exam_invites_assignment ON exam_invites(assignment_id);

ALTER TABLE exam_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage invites for own assignments" ON exam_invites;
CREATE POLICY "Owners manage invites for own assignments"
  ON exam_invites FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM exam_assignments ea
      WHERE ea.id = exam_invites.assignment_id
      AND ea.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM exam_assignments ea
      WHERE ea.id = exam_invites.assignment_id
      AND ea.owner_id = auth.uid()
    )
  );

-- Allow examinees (logged-in users) to view invites addressed to their email.
-- Use JWT email (not auth.users): the authenticated role cannot SELECT auth.users.
DROP POLICY IF EXISTS "Examinees can view own invites" ON exam_invites;
CREATE POLICY "Examinees can view own invites"
  ON exam_invites FOR SELECT
  TO authenticated
  USING (
    (revoked_at IS NULL)
    AND ((select auth.jwt()) ->> 'email') IS NOT NULL
    AND lower(email) = lower(trim((select auth.jwt()) ->> 'email'))
  );

-- Allow multiple issues over time: enforce only one *active* invite per email.
ALTER TABLE exam_invites DROP CONSTRAINT IF EXISTS exam_invites_assignment_id_email_key;
DROP INDEX IF EXISTS idx_exam_invites_active_unique;
CREATE UNIQUE INDEX idx_exam_invites_active_unique
  ON exam_invites (assignment_id, email)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS exam_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES exam_assignments(id) ON DELETE CASCADE,
  invite_id UUID NOT NULL REFERENCES exam_invites(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'submitted', 'expired')) DEFAULT 'in_progress',
  current_index INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  answers_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (invite_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_attempts_assignment ON exam_attempts(assignment_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_invite ON exam_attempts(invite_id);

ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;

-- Owners can view attempts for their own assignments (for results dashboard).
DROP POLICY IF EXISTS "Owners can view attempts for own assignments" ON exam_attempts;
CREATE POLICY "Owners can view attempts for own assignments"
  ON exam_attempts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM exam_assignments ea
      WHERE ea.id = exam_attempts.assignment_id
      AND ea.owner_id = auth.uid()
    )
  );

-- Examinees can view their own attempt (join through their invite email).
DROP POLICY IF EXISTS "Examinees can view own attempts" ON exam_attempts;
CREATE POLICY "Examinees can view own attempts"
  ON exam_attempts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM exam_invites i
      WHERE i.id = exam_attempts.invite_id
      AND i.revoked_at IS NULL
      AND ((select auth.jwt()) ->> 'email') IS NOT NULL
      AND lower(i.email) = lower(trim((select auth.jwt()) ->> 'email'))
    )
  );
