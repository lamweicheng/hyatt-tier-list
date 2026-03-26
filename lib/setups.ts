import { PILLARS } from "./constants";

export type Recurrence = "Monthly" | "Quarterly" | "Yearly";

export const WEEKDAY_OPTIONS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export type Weekday = (typeof WEEKDAY_OPTIONS)[number];

export const NTH_WEEKDAY_OPTIONS = [1, 2, 3, 4, 5] as const;
export type NthWeekday = (typeof NTH_WEEKDAY_OPTIONS)[number];

export const QUARTER_MONTH_IN_PERIOD_OPTIONS = [1, 2, 3] as const;
export type QuarterMonthInPeriod = (typeof QUARTER_MONTH_IN_PERIOD_OPTIONS)[number];

export const MONTH_OF_YEAR_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export type MonthOfYear = (typeof MONTH_OF_YEAR_OPTIONS)[number];

type TpmSubmissionScheduleAlignment = {
  // Used when recurrence is Quarterly (1=first month of the quarter, 3=last month).
  periodMonthInQuarter?: QuarterMonthInPeriod;
  // Used when recurrence is Yearly (1=January ... 12=December).
  periodMonthOfYear?: MonthOfYear;
};

export type TpmSubmissionScheduleRule =
  | ({
      type: "FixedCalendarDate";
      dayOfMonth: number;
    } & TpmSubmissionScheduleAlignment)
  | ({
      type: "NthWeekdayOfMonth";
      nth: NthWeekday;
      weekday: Weekday;
    } & TpmSubmissionScheduleAlignment)
  | ({
      type: "LastWeekdayOfMonth";
      weekday: Weekday;
    } & TpmSubmissionScheduleAlignment);

export const DEFAULT_TPM_SUBMISSION_SCHEDULE: TpmSubmissionScheduleRule = {
  type: "FixedCalendarDate",
  dayOfMonth: 25,
  periodMonthInQuarter: 3,
  periodMonthOfYear: 3
};

export type DefaultBusinessDays = {
  // Suggested minimum business days assignees have from the start of the instance period until Preparation due.
  preparation: number;
  // Business days between Preparation due and Review due.
  review: number;
  // Business days between Review due and TPM Submission due.
  submission: number;
};

export const DEFAULT_BUSINESS_DAYS: DefaultBusinessDays = {
  preparation: 10,
  review: 3,
  submission: 3
};

export type SetupRow = {
  id: string;
  pillar: (typeof PILLARS)[number];
  tpm: string;
  products: string[];
  tpmLocation?: string;
  tpmPreviousCompanyName?: string;
  firmPeriod?: number | null;
  rollingForecastHorizon?: number | null;
  assignees: string[];
  approvers: string[];
  recurrence: Recurrence;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  tpmSubmissionSchedule: TpmSubmissionScheduleRule;
  defaultBusinessDays: DefaultBusinessDays;
};

export function formatProductsLabel(products: string[]) {
  return (products ?? []).filter(Boolean).join(", ");
}

export const RECURRENCE_OPTIONS: Recurrence[] = ["Monthly", "Quarterly", "Yearly"];

export const BASE_SETUPS: SetupRow[] = [
  {
    id: "FS-001",
    pillar: "Device",
    tpm: "TPM A",
    products: ["Product A"],
    tpmLocation: "North America",
    tpmPreviousCompanyName: "Company X",
    firmPeriod: 3,
    rollingForecastHorizon: 12,
    assignees: ["GSP Planner A"],
    approvers: ["Approver A", "Approver B"],
    recurrence: "Monthly",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    tpmSubmissionSchedule: DEFAULT_TPM_SUBMISSION_SCHEDULE,
    defaultBusinessDays: DEFAULT_BUSINESS_DAYS
  },
  {
    id: "FS-002",
    pillar: "Aseptic",
    tpm: "TPM B",
    products: ["Product B"],
    tpmLocation: "Europe",
    tpmPreviousCompanyName: "Company Y",
    firmPeriod: 6,
    rollingForecastHorizon: 18,
    assignees: ["EM Manager", "GSP Planner B"],
    approvers: ["Approver B"],
    recurrence: "Quarterly",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    tpmSubmissionSchedule: DEFAULT_TPM_SUBMISSION_SCHEDULE,
    defaultBusinessDays: DEFAULT_BUSINESS_DAYS
  }
];

export function nextSetupId(existingIds: string[]) {
  let max = 0;
  for (const id of existingIds) {
    const match = /^FS-(\d+)$/.exec(id);
    if (!match) continue;
    const n = Number(match[1]);
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  const next = max + 1;
  return `FS-${String(next).padStart(3, "0")}`;
}
