# RLS recursion bug — `organization_groups` — root cause & fix

**Status:** root cause confirmed. Fix not yet applied (hand this to Cursor).
**Reported:** Account page (`/account`) shows the error
`infinite recursion detected in policy for relation "organization_groups"`.
**Note:** unrelated to the recent Supabase SMTP / email fix.

---

## Symptom

Opening `localhost:3000/account` (and any page that reads class-group data)
renders an error box:

> infinite recursion detected in policy for relation "organization_groups"

The page can't load because the database refuses to evaluate the query.

---

## Root cause (plain language)

Two Row-Level Security (RLS) rules reference each other in a circle:

- The rule on **`organization_groups`** ("which groups can I see?") answers by
  querying the **`organization_group_members`** table.
- The rule on **`organization_group_members`** ("which memberships can I see?")
  answers by querying the **`organization_groups`** table.

So evaluating either policy re-triggers the other policy, which re-triggers the
first, with no termination. Postgres detects the cycle and aborts with
*"infinite recursion detected."*

This is the **same class of bug** already fixed elsewhere in this repo for
`organizations` / `organization_members` and `decks` / `items`. Those were fixed
by routing the cross-table check through a **SECURITY DEFINER helper function**,
which bypasses the caller's RLS and therefore breaks the loop. The two group
tables were never given that treatment.

---

## Exact location

Both offending policies live in
`supabase/organization-groups-extension.sql`.

**Policy A — on `organization_groups`:**

```sql
CREATE POLICY "Members view groups by role"
  ON organization_groups FOR SELECT
  TO authenticated
  USING (
    public.organization_role(organization_id, auth.uid()) IN ('admin', 'teacher')
    OR EXISTS (                                   -- <-- reads organization_group_members
      SELECT 1 FROM organization_group_members gm
      WHERE gm.group_id = organization_groups.id
        AND gm.user_id = auth.uid()
    )
  );
```

**Policy B — on `organization_group_members`:**

```sql
CREATE POLICY "Members view group membership by role"
  ON organization_group_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (                                      -- <-- reads organization_groups
      SELECT 1 FROM organization_groups g
      WHERE g.id = organization_group_members.group_id
        AND (
          public.organization_role(g.organization_id, auth.uid()) IN ('admin', 'teacher')
          OR organization_group_members.user_id = auth.uid()
        )
        AND public.is_organization_member(g.organization_id, auth.uid())
    )
  );
```

Policy A reads table B; Policy B reads table A → mutual recursion.

The helper pattern that avoids this already exists — see
`supabase/organization-schema.sql` (`public.organization_role`,
`public.is_organization_member`, both `SECURITY DEFINER`) and
`supabase/organization-rls-recursion-fix.sql`
(`public.deck_readable_via_org_share`).

---

## Fix (for Cursor)

Create a new migration `supabase/organization-groups-rls-recursion-fix.sql`
that introduces two SECURITY DEFINER helpers and rewrites both policies to use
them. SECURITY DEFINER functions run without the caller's RLS, so neither
policy re-enters the other. **Access rules stay identical — only the recursion
is removed.** Safe to re-run.

```sql
-- PSTUDY: fix RLS infinite recursion between
-- organization_groups <-> organization_group_members.
-- Run once in Supabase SQL Editor (safe to re-run).

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

-- 3) Rewrite organization_groups SELECT policy (no longer reads the members table directly)
DROP POLICY IF EXISTS "Members view groups by role" ON organization_groups;
CREATE POLICY "Members view groups by role"
  ON organization_groups FOR SELECT
  TO authenticated
  USING (
    public.organization_role(organization_id, auth.uid()) IN ('admin', 'teacher')
    OR public.user_in_group(organization_groups.id, auth.uid())
  );

-- 4) Rewrite organization_group_members SELECT policy (no longer reads the groups table directly)
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
```

### Why this works

- `user_in_group` and `group_organization_id` are `SECURITY DEFINER`, so when a
  policy calls them they execute **without** re-applying the calling table's RLS.
  That cuts the A→B→A cycle.
- The visibility logic is unchanged:
  - Admins/teachers see all groups in their org; students see only groups they
    belong to.
  - Admins/teachers see full rosters; students see only their own membership row.

### After applying

1. Run the migration in the Supabase SQL Editor.
2. Reload `/account` — the error should be gone and the activity snapshot loads.
3. Sanity-check a student account: they should still see only their own groups
   and their own membership rows, not classmates'.

---

## Reviewer notes

- Only the two group-table policies need changing; the `organization_role` /
  `is_organization_member` helpers are already correct and reused here.
- No application/TypeScript changes are required — this is purely a database
  (RLS) fix.
- Keep the existing convention: one numbered/descriptive `.sql` file per change,
  `DROP POLICY IF EXISTS` before `CREATE`, `REVOKE`/`GRANT` on new functions.
