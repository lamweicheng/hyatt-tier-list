export const PILLARS = ['Aseptic', 'BDS', 'Device', 'API', 'Packaging'] as const;

export type Pillar = (typeof PILLARS)[number];

export const TPM_OPTIONS = ["TPM A", "TPM B", "TPM C"] as const;
export const ASSIGNEE_OPTIONS = ["EM Manager", "GSP Planner A", "GSP Planner B", "GSP Planner C"] as const;
// Backward-compatible alias (internal naming only).
export const GSP_PLANNER_OPTIONS = ASSIGNEE_OPTIONS;
export const APPROVER_OPTIONS = ["Approver A", "Approver B", "Approver C"] as const;
