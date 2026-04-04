export type AccountOverviewPayload = {
  email: string | null;
  memberSince: string | null;
  decks: {
    total: number;
    private: number;
    sharedDraft: number;
    sharedChecked: number;
  };
  itemsTotal: number;
  examsIssued: number;
  examsToTake: number;
  aiCreditsHint: string | null;
};
