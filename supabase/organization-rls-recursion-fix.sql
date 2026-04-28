-- PSTUDY: fix RLS infinite recursion on `decks` / `items` after organization-schema.sql
-- Symptom: dashboard "Failed to load decks", PostgREST may report infinite recursion in policy.
-- Run once in Supabase SQL Editor (safe to re-run).

CREATE OR REPLACE FUNCTION public.deck_readable_via_org_share(p_deck_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM deck_organization_shares s
    WHERE s.deck_id = p_deck_id
      AND (
        (
          s.visibility = 'teachers_only'
          AND public.organization_role(s.organization_id, auth.uid()) IN ('teacher', 'admin')
        )
        OR (
          s.visibility = 'school'
          AND public.organization_role(s.organization_id, auth.uid()) IN ('teacher', 'admin')
        )
        OR (
          s.visibility = 'school'
          AND public.organization_role(s.organization_id, auth.uid()) = 'student'
          AND EXISTS (
            SELECT 1
            FROM deck_organization_verifications v
            WHERE v.deck_id = s.deck_id
              AND v.organization_id = s.organization_id
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.deck_readable_via_org_share(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deck_readable_via_org_share(uuid) TO authenticated;

DROP POLICY IF EXISTS "Org members read shared decks" ON decks;
CREATE POLICY "Org members read shared decks"
  ON decks FOR SELECT
  TO authenticated
  USING (public.deck_readable_via_org_share(decks.id));

DROP POLICY IF EXISTS "Org members read items of shared decks" ON items;
CREATE POLICY "Org members read items of shared decks"
  ON items FOR SELECT
  TO authenticated
  USING (public.deck_readable_via_org_share(items.deck_id));
