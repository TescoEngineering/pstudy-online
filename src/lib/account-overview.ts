import type { OrganizationRole } from "@/types/organization";

export type AccountCommunityRow = {
  organizationId: string;
  name: string;
  slug: string | null;
  role: OrganizationRole;
  /** Populated for students: group names in this organization (no roster). */
  myGroups?: string[];
};

export type AccountOverviewPayload = {
  email: string | null;
  memberSince: string | null;
  decks: {
    total: number;
    private: number;
    sharedDraft: number;
    sharedChecked: number;
    sharedVerified: number;
  };
  itemsTotal: number;
  examsIssued: number;
  examsToTake: number;
  aiCreditsHint: string | null;
  /** Organizations (MyCommunities) the user belongs to. */
  communities: AccountCommunityRow[];
};
