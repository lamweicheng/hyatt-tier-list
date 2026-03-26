import { PILLARS } from "./constants";

export type RecordPhaseId = 0 | 1 | 2 | 3 | 4;

export type RecordRow = {
  id: string;
  pillar: (typeof PILLARS)[number];
  tpm: string;
  requestedBy?: string;
  requestedDate?: string; // YYYY-MM-DD
  emManagerComments?: string;
  // New generic naming
  assignees?: string[];
  assigneeComments?: string;
  // Backward-compatible fields (legacy internal naming only)
  gspPlanner?: string;
  approvers?: string[];
  gspPlannerComments?: string;
  approverCommentsToAssignees?: string;
  gspForecastDue?: string; // YYYY-MM-DD
  approverReviewDue?: string; // YYYY-MM-DD
  tpmSubmissionDue: string; // YYYY-MM-DD
  sentToTpm?: boolean;
  sentToTpmDate?: string; // YYYY-MM-DD
  tpmConfirmedDate?: string; // YYYY-MM-DD
  closeRequested?: boolean;
  phaseId: RecordPhaseId;
  forecastPdfHref?: string;
  closed: boolean;
};

export const BASE_RECORDS: RecordRow[] = [
  {
    id: "FC-001",
    pillar: "Aseptic",
    tpm: "TPM A",
    requestedBy: "Record Creator",
    requestedDate: "2026-02-10",
    assignees: ["GSP Planner A"],
    approvers: ["Approver A", "Approver B"],
    emManagerComments: "Please align assumptions with last cycle and highlight key drivers.",
    assigneeComments: "Draft forecast ready for review. Key changes: updated demand assumptions for Q2.",
    gspForecastDue: "2026-02-14",
    approverReviewDue: "2026-02-18",
    tpmSubmissionDue: "2026-02-21",
    phaseId: 1,
    closed: false
  },
  {
    id: "FC-002",
    pillar: "BDS",
    tpm: "TPM B",
    requestedBy: "Record Creator",
    requestedDate: "2026-02-08",
    assignees: ["EM Manager", "GSP Planner B"],
    approvers: ["Approver B", "Approver C"],
    emManagerComments: "Focus on supply constraints and risks. Use the latest yield data.",
    assigneeComments: "Uploaded forecast. Please review the updated assumptions for Q3 and Q4.",
    gspForecastDue: "2026-02-12",
    approverReviewDue: "2026-02-20",
    tpmSubmissionDue: "2026-02-25",
    phaseId: 2,
    closed: false
  },
  {
    id: "FC-003",
    pillar: "Device",
    tpm: "TPM C",
    requestedBy: "Record Creator",
    requestedDate: "2026-02-05",
    assignees: ["GSP Planner C"],
    approvers: ["Approver A", "Approver C"],
    emManagerComments: "Ensure BOM changes are reflected; include variance notes.",
    assigneeComments: "Forecast approved by approvers. Ready to send to TPM.",
    gspForecastDue: "2026-02-11",
    approverReviewDue: "2026-02-28",
    tpmSubmissionDue: "2026-03-04",
    phaseId: 3,
    closed: false
  },
  {
    id: "FC-004",
    pillar: "API",
    tpm: "TPM A",
    requestedBy: "Record Creator",
    requestedDate: "2026-02-10",
    assignees: ["EM Manager"],
    approvers: ["Approver A"],
    emManagerComments: "New cycle setup. Add any key notes for the assignee(s).",
    gspForecastDue: "2026-02-16",
    approverReviewDue: "2026-02-24",
    tpmSubmissionDue: "2026-03-10",
    phaseId: 0,
    closed: false
  },
  {
    id: "FC-005",
    pillar: "Packaging",
    tpm: "TPM B",
    requestedBy: "Record Creator",
    requestedDate: "2026-01-15",
    assignees: ["GSP Planner B"],
    approvers: ["Approver A", "Approver B", "Approver C"],
    emManagerComments: "Final cycle for the month. Please keep notes concise.",
    assigneeComments: "Final forecast uploaded and approved.",
    gspForecastDue: "2026-01-22",
    approverReviewDue: "2026-01-30",
    tpmSubmissionDue: "2026-03-15",
    phaseId: 4,
    forecastPdfHref: "/sample-forecast.pdf",
    closed: true
  },
  {
    id: "FC-006",
    pillar: "Aseptic",
    tpm: "TPM C",
    requestedBy: "Record Creator",
    requestedDate: "2026-02-01",
    assignees: ["GSP Planner C"],
    approvers: ["Approver B"],
    emManagerComments: "Pending final storage; ensure correct filename and folder.",
    assigneeComments: "Approved forecast ready for storage.",
    gspForecastDue: "2026-02-06",
    approverReviewDue: "2026-02-12",
    tpmSubmissionDue: "2026-03-18",
    phaseId: 4,
    closed: false
  },
  {
    id: "FC-007",
    pillar: "Device",
    tpm: "TPM A",
    requestedBy: "Record Creator",
    requestedDate: "2026-02-03",
    assignees: ["EM Manager"],
    approvers: ["Approver A", "Approver B"],
    emManagerComments: "Awaiting TPM confirmation email. Upload confirmation once received.",
    assigneeComments: "Sent to TPM and awaiting confirmation.",
    gspForecastDue: "2026-02-07",
    approverReviewDue: "2026-02-14",
    tpmSubmissionDue: "2026-02-19",
    phaseId: 4,
    closed: false
  }
];

export function nextRecordId(existingIds: string[]) {
  let max = 0;
  for (const id of existingIds) {
    const match = /^FC-(\d+)$/.exec(id);
    if (!match) continue;
    const n = Number(match[1]);
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  const next = max + 1;
  return `FC-${String(next).padStart(3, "0")}`;
}
