-- PSTUDY: fix RLS infinite recursion between
-- organization_groups <-> organization_group_members.
--
-- Symptom: pages that read class-group data (e.g. /account) fail with
--   "infinite recursion detected in policy for relation organization_groups".
-- Cause: the SELECT policy on organization_groups reads organization_group_members,
--   and the SELECT policy on organization_group_members reads organization_groups,
--   so evaluating either policy re-triggers the other without termination.
-- Fix: route both cross-table checks through SECURITY DEFINER helper functions,
--   which execute without the caller's RLS and therefore break the cycle.
--   Access rules are unchanged — only the recursion is removed.
--
-- Run once in Supabase SQL Editor. Safe to re-run.

-- 1) Is this user a member of this group? (bypasses RLS -> no recursion)
CREATE OR REPLACE FUNCTION public.user_in_group(p_group_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_group_members gm
    WHERE gm.group_id = p_group_id
      AND gm.user_id = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.user_in_group(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_in_group(uuid, uuid) TO authenticated;

-- 2) Which organization does this group belong to? (bypasses RLS -> no recursion)
CREATE OR REPLACE FUNCTION public.group_organization_id(p_group_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.organization_id
  FROM organization_groups g
  WHERE g.id = p_group_id;
$$;

REVOKE ALL ON FUNCTION public.group_organization_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.group_organization_id(uuid) TO authenticated;

-- 3) organization_groups SELECT policy — no longer reads the members table directly.
--    Admins/teachers see all groups in their org; students see only groups they belong to.
DROP POLICY IF EXISTS "Members view groups by role" ON organization_groups;
CREATE POLICY "Members view groups by role"
  ON organization_groups FOR SELECT
  TO authenticated
  USING (
    public.organization_role(organization_id, auth.uid()) IN ('admin', 'teacher')
    OR public.user_in_group(organization_groups.id, auth.uid())
  );

-- 4) organization_group_members SELECT policy — no longer reads the groups table directly.
--    Admins/teachers see full rosters; students see only their own membership rows.
DROP POLICY IF EXISTS "Members view group membership by role" ON organization_group_members;
CREATE POLICY "Members view group membership by role"
  ON organization_group_members FOR SELECT
  TO authenticated
  USING (
    public.is_organization_member(
      public.group_organization_id(organization_group_members.group_id),
      auth.uid()
    )
    AND (
      public.organization_role(
        public.group_organization_id(organization_group_members.group_id),
        auth.uid()
      ) IN ('admin', 'teacher')
      OR organization_group_members.user_id = auth.uid()
    )
  );
