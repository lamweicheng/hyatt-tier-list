export type UIForecastRecord = {
  id: string;
  pillar: string;
  emManagerName: string;
  emManagerEmail?: string | null;
  gspPlannerName: string;
  gspPlannerEmail?: string | null;
  tpmName?: string | null;
  tpmEmail?: string | null;
  duePreparation: string; // ISO string
  dueReview: string; // ISO string
  dueSubmission: string; // ISO string
  status: string;
  createdAt: string;
};
