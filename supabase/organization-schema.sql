-- PSTUDY: school / institution organizations (schema + RLS)
-- Run in Supabase SQL Editor AFTER base schema, publication-review.sql, and exam-schema (decks must exist).
--
-- Model (v1):
-- - organizations + organization_members (roles: student | teacher | admin) + max_members seat cap
-- - organization_groups + organization_group_members (managed by org admins)
-- - deck_organization_shares: share a deck into ONE org layer: school (all members) | teachers_only (staff)
-- - deck_organization_verifications: teacher/admin "verified" gate for school visibility (students see school
--   shares only when a verification row exists; staff can see unverified school shares for the workflow)
-- Worldwide "ww" sharing stays on decks.is_public + existing publication_checked flow — not in this file.
--
-- Bootstrap: INSERT into organizations and the first organization_members (admin) row using the
-- Supabase service role or SQL Editor (authenticated RLS cannot create the first admin).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  max_members INTEGER NOT NULL DEFAULT 500 CHECK (max_members > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

CREATE TABLE IF NOT EXISTS organization_members (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_members_user ON organization_members(user_id);

CREATE TABLE IF NOT EXISTS organization_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_organization_groups_org ON organization_groups(organization_id);

CREATE TABLE IF NOT EXISTS organization_group_members (
  group_id UUID NOT NULL REFERENCES organization_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_group_members_user ON organization_group_members(user_id);

CREATE TABLE IF NOT EXISTS deck_organization_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  visibility TEXT NOT NULL CHECK (visibility IN ('school', 'teachers_only')),
  shared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (deck_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_deck_org_shares_deck ON deck_organization_shares(deck_id);
CREATE INDEX IF NOT EXISTS idx_deck_org_shares_org ON deck_organization_shares(organization_id);

CREATE TABLE IF NOT EXISTS deck_organization_verifications (
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  verified_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (deck_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_deck_org_verif_org ON deck_organization_verifications(organization_id);

COMMENT ON TABLE organizations IS 'School / company tenant; operator creates rows (service role / SQL).';
COMMENT ON TABLE organization_members IS 'Membership + role: student | teacher | admin.';
COMMENT ON TABLE deck_organization_shares IS 'Deck published inside an org: school (members) or teachers_only (staff).';
COMMENT ON TABLE deck_organization_verifications IS 'Teacher/admin verification; students need this to see school shares.';

-- ---------------------------------------------------------------------------
-- Seat cap (before insert member)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_organization_member_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnt INTEGER;
  cap INTEGER;
BEGIN
  SELECT max_members INTO cap FROM organizations WHERE id = NEW.organization_id;
  IF cap IS NULL THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;
  SELECT COUNT(*)::INTEGER INTO cnt FROM organization_members
  WHERE organization_id = NEW.organization_id;
  IF cnt >= cap THEN
    RAISE EXCEPTION 'Organization member limit reached (max %)', cap;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_organization_members_limit ON organization_members;
CREATE TRIGGER trg_organization_members_limit
  BEFORE INSERT ON organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_organization_member_limit();
-- PostgreSQL 13 / older: use EXECUTE PROCEDURE instead of EXECUTE FUNCTION above (and for trg_deck_org_shares_touch).

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER: avoids RLS recursion)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.organization_role(p_organization_id UUID, p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.role FROM organization_members m
  WHERE m.organization_id = p_organization_id
    AND m.user_id = p_user_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_organization_member(p_organization_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members m
    WHERE m.organization_id = p_organization_id AND m.user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.touch_deck_organization_shares()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deck_org_shares_touch ON deck_organization_shares;
CREATE TRIGGER trg_deck_org_shares_touch
  BEFORE UPDATE ON deck_organization_shares
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_deck_organization_shares();

-- ---------------------------------------------------------------------------
-- RLS: organizations
-- ---------------------------------------------------------------------------

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view their organizations" ON organizations;
CREATE POLICY "Members can view their organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (public.is_organization_member(organizations.id, auth.uid()));

-- ---------------------------------------------------------------------------
-- RLS: organization_members
-- ---------------------------------------------------------------------------

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view members in same org" ON organization_members;
CREATE POLICY "Members can view members in same org"
  ON organization_members FOR SELECT
  TO authenticated
  USING (public.is_organization_member(organization_members.organization_id, auth.uid()));

DROP POLICY IF EXISTS "Admins can insert members" ON organization_members;
CREATE POLICY "Admins can insert members"
  ON organization_members FOR INSERT
  TO authenticated
  WITH CHECK (public.organization_role(organization_id, auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Admins can update members" ON organization_members;
CREATE POLICY "Admins can update members"
  ON organization_members FOR UPDATE
  TO authenticated
  USING (public.organization_role(organization_id, auth.uid()) = 'admin')
  WITH CHECK (public.organization_role(organization_id, auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Admins can remove members" ON organization_members;
CREATE POLICY "Admins can remove members"
  ON organization_members FOR DELETE
  TO authenticated
  USING (public.organization_role(organization_id, auth.uid()) = 'admin');

-- ---------------------------------------------------------------------------
-- RLS: organization_groups
-- ---------------------------------------------------------------------------

ALTER TABLE organization_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view groups in org" ON organization_groups;
CREATE POLICY "Members can view groups in org"
  ON organization_groups FOR SELECT
  TO authenticated
  USING (public.is_organization_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "Admins manage groups" ON organization_groups;
CREATE POLICY "Admins manage groups"
  ON organization_groups FOR ALL
  TO authenticated
  USING (public.organization_role(organization_id, auth.uid()) = 'admin')
  WITH CHECK (public.organization_role(organization_id, auth.uid()) = 'admin');

-- ---------------------------------------------------------------------------
-- RLS: organization_group_members
-- ---------------------------------------------------------------------------

ALTER TABLE organization_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view group membership" ON organization_group_members;
CREATE POLICY "Members can view group membership"
  ON organization_group_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_groups g
      WHERE g.id = organization_group_members.group_id
        AND public.is_organization_member(g.organization_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins manage group membership" ON organization_group_members;
CREATE POLICY "Admins manage group membership"
  ON organization_group_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_groups g
      WHERE g.id = organization_group_members.group_id
        AND public.organization_role(g.organization_id, auth.uid()) = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_groups g
      WHERE g.id = organization_group_members.group_id
        AND public.organization_role(g.organization_id, auth.uid()) = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: deck_organization_shares
-- ---------------------------------------------------------------------------

ALTER TABLE deck_organization_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read deck org shares" ON deck_organization_shares;
CREATE POLICY "Read deck org shares"
  ON deck_organization_shares FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM decks d WHERE d.id = deck_id AND d.owner_id = auth.uid())
    OR (
      visibility = 'teachers_only'
      AND public.organization_role(organization_id, auth.uid()) IN ('teacher', 'admin')
    )
    OR (
      visibility = 'school'
      AND public.organization_role(organization_id, auth.uid()) IN ('teacher', 'admin')
    )
    OR (
      visibility = 'school'
      AND public.organization_role(organization_id, auth.uid()) = 'student'
      AND EXISTS (
        SELECT 1 FROM deck_organization_verifications v
        WHERE v.deck_id = deck_organization_shares.deck_id
          AND v.organization_id = deck_organization_shares.organization_id
      )
    )
  );

DROP POLICY IF EXISTS "Deck owners insert org shares" ON deck_organization_shares;
CREATE POLICY "Deck owners insert org shares"
  ON deck_organization_shares FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM decks d WHERE d.id = deck_id AND d.owner_id = auth.uid())
    AND shared_by = auth.uid()
    AND public.is_organization_member(organization_id, auth.uid())
    AND (
      (
        visibility = 'school'
        AND public.organization_role(organization_id, auth.uid()) IN ('student', 'teacher', 'admin')
      )
      OR (
        visibility = 'teachers_only'
        AND public.organization_role(organization_id, auth.uid()) IN ('teacher', 'admin')
      )
    )
  );

DROP POLICY IF EXISTS "Deck owners update org shares" ON deck_organization_shares;
CREATE POLICY "Deck owners update org shares"
  ON deck_organization_shares FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM decks d WHERE d.id = deck_id AND d.owner_id = auth.uid()))
  WITH CHECK (
    EXISTS (SELECT 1 FROM decks d WHERE d.id = deck_id AND d.owner_id = auth.uid())
    AND public.is_organization_member(organization_id, auth.uid())
    AND (
      (
        visibility = 'school'
        AND public.organization_role(organization_id, auth.uid()) IN ('student', 'teacher', 'admin')
      )
      OR (
        visibility = 'teachers_only'
        AND public.organization_role(organization_id, auth.uid()) IN ('teacher', 'admin')
      )
    )
  );

DROP POLICY IF EXISTS "Deck owners delete org shares" ON deck_organization_shares;
CREATE POLICY "Deck owners delete org shares"
  ON deck_organization_shares FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM decks d WHERE d.id = deck_id AND d.owner_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- RLS: deck_organization_verifications
-- ---------------------------------------------------------------------------

ALTER TABLE deck_organization_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members read verifications" ON deck_organization_verifications;
CREATE POLICY "Org members read verifications"
  ON deck_organization_verifications FOR SELECT
  TO authenticated
  USING (public.is_organization_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "Teachers insert school verification" ON deck_organization_verifications;
CREATE POLICY "Teachers insert school verification"
  ON deck_organization_verifications FOR INSERT
  TO authenticated
  WITH CHECK (
    public.organization_role(organization_id, auth.uid()) IN ('teacher', 'admin')
    AND verified_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM deck_organization_shares s
      WHERE s.deck_id = deck_organization_verifications.deck_id
        AND s.organization_id = deck_organization_verifications.organization_id
        AND s.visibility = 'school'
    )
  );

DROP POLICY IF EXISTS "Admins delete verification" ON deck_organization_verifications;
CREATE POLICY "Admins delete verification"
  ON deck_organization_verifications FOR DELETE
  TO authenticated
  USING (public.organization_role(organization_id, auth.uid()) = 'admin');

-- ---------------------------------------------------------------------------
-- RLS: decks / items — org-shared reads (SECURITY DEFINER avoids RLS recursion:
-- decks policy must not query deck_organization_shares under normal RLS, because
-- shares policies reference decks → infinite recursion on SELECT decks.)
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- RLS: items — read rows for org-shared decks
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Org members read items of shared decks" ON items;
CREATE POLICY "Org members read items of shared decks"
  ON items FOR SELECT
  TO authenticated
  USING (public.deck_readable_via_org_share(items.deck_id));
