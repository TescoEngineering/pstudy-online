/** Matches organizations.role in DB (organization-schema.sql). */
export type OrganizationRole = "student" | "teacher" | "admin";

/** Visibility for deck_organization_shares.visibility */
export type DeckOrgShareVisibility = "school" | "teachers_only";

export type OrganizationRow = {
  id: string;
  name: string;
  slug: string | null;
  maxMembers: number;
  createdAt: string;
  createdBy: string | null;
};

export type OrganizationMemberRow = {
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  joinedAt: string;
};

export type OrganizationGroupRow = {
  id: string;
  organizationId: string;
  name: string;
  createdAt: string;
  createdBy: string | null;
};

export type DeckOrganizationShareRow = {
  id: string;
  deckId: string;
  organizationId: string;
  visibility: DeckOrgShareVisibility;
  sharedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type DeckOrganizationVerificationRow = {
  deckId: string;
  organizationId: string;
  verifiedBy: string;
  verifiedAt: string;
};
