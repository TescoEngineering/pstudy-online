-- PSTUDY: organization groups — description, name uniqueness, invite queue, tighter RLS
-- Run in Supabase SQL Editor after organization-schema.sql and organization-invites.sql.
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS where applicable.

-- ---------------------------------------------------------------------------
-- organization_groups: optional description + unique name per org (case-insensitive)
-- ---------------------------------------------------------------------------

ALTER TABLE organization_groups
  ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN organization_groups.description IS 'Optional admin-visible description.';

CREATE UNIQUE INDEX IF NOT EXISTS organization_groups_org_name_lower_unique
  ON organization_groups (organization_id, (lower(trim(name))));

-- ---------------------------------------------------------------------------
-- organization_group_invite_queue: auto-add to group when org invite accepted
-- Access: Next.js API routes with service role only (no RLS policies, like organization_invites).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS organization_group_invite_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES organization_groups(id) ON DELETE CASCADE,
  email_normalized TEXT NOT NULL,
  queued_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_org_group_invite_queue_org_email
  ON organization_group_invite_queue (organization_id, email_normalized)
  WHERE applied_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS organization_group_invite_queue_pending_unique
  ON organization_group_invite_queue (group_id, email_normalized)
  WHERE applied_at IS NULL;

COMMENT ON TABLE organization_group_invite_queue IS
  'When an org invite is accepted, pending rows for the invited email add the user to the listed groups. Rows CASCADE away if the group is deleted.';

ALTER TABLE organization_group_invite_queue ENABLE ROW LEVEL SECURITY;

-- Intentionally no policies: same pattern as organization_invites (service role from API only).

-- ---------------------------------------------------------------------------
-- RLS: organization_groups — students only see groups they belong to;
-- teachers and admins see all groups in the organization.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Members can view groups in org" ON organization_groups;
DROP POLICY IF EXISTS "Members view groups by role" ON organization_groups;

CREATE POLICY "Members view groups by role"
  ON organization_groups FOR SELECT
  TO authenticated
  USING (
    public.organization_role(organization_id, auth.uid()) IN ('admin', 'teacher')
    OR EXISTS (
      SELECT 1 FROM organization_group_members gm
      WHERE gm.group_id = organization_groups.id
        AND gm.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: organization_group_members — teachers/admins see full rosters;
-- students only see their own membership rows (not classmates).
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Members can view group membership" ON organization_group_members;

CREATE POLICY "Members view group membership by role"
  ON organization_group_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_groups g
      WHERE g.id = organization_group_members.group_id
        AND (
          public.organization_role(g.organization_id, auth.uid()) IN ('admin', 'teacher')
          OR organization_group_members.user_id = auth.uid()
        )
        AND public.is_organization_member(g.organization_id, auth.uid())
    )
  );
