-- PSTUDY: fix organization / organization_members SELECT RLS for browser clients
-- Symptom: School page shows "not a member of a school organization yet" even after SQL bootstrap.
-- Cause: self-referential EXISTS on organization_members fails under RLS for the same table.
-- Run once in Supabase SQL Editor after organization-schema.sql.

DROP POLICY IF EXISTS "Members can view their organizations" ON organizations;
CREATE POLICY "Members can view their organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (public.is_organization_member(organizations.id, auth.uid()));

DROP POLICY IF EXISTS "Members can view members in same org" ON organization_members;
CREATE POLICY "Members can view members in same org"
  ON organization_members FOR SELECT
  TO authenticated
  USING (public.is_organization_member(organization_members.organization_id, auth.uid()));
