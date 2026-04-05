-- PSTUDY: organization (school) invites for admin-driven onboarding
-- Run after organization-schema.sql. Uses service role from Next.js API routes (RLS blocks direct client access).

CREATE TABLE IF NOT EXISTS organization_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
  access_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  accepted_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_organization_invites_org ON organization_invites(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_invites_token ON organization_invites(access_token);
CREATE INDEX IF NOT EXISTS idx_organization_invites_email ON organization_invites((lower(trim(email))));

CREATE UNIQUE INDEX IF NOT EXISTS organization_invites_one_pending_per_email
  ON organization_invites (organization_id, (lower(trim(email))))
  WHERE status = 'pending';

ALTER TABLE organization_invites ENABLE ROW LEVEL SECURITY;

-- No policies: end users access only via API (service role). Keeps tokens off the public anon key.

COMMENT ON TABLE organization_invites IS 'Email invite to join an organization with a role; accept after sign-in with matching email.';
