import type { SetupRow, Recurrence, TpmSubmissionScheduleRule, Weekday } from "./setups";
import { DEFAULT_BUSINESS_DAYS } from "./setups";
import { BASE_SETUPS } from "./setups";
import { formatProductsLabel } from "./setups";
import { PILLARS } from "./constants";

export type CyclePhaseId = 0 | 1 | 2 | 3 | 4;

export type ForecastCycleRow = {
  id: string;
  setupId: string;
  label: string;
  cycleStart: string; // YYYY-MM-DD
  cycleEnd: string; // YYYY-MM-DD

  pillar: (typeof PILLARS)[number];
  tpm: string;
  products: string[];
  tpmLocation?: string;
  tpmPreviousCompanyName?: string;

  requestedBy?: string;
  requestedDate?: string; // YYYY-MM-DD
  emManagerComments?: string;

  assignees?: string[];
  assigneeComments?: string;
  approvers?: string[];

  approverCommentsToAssignees?: string;

  gspForecastDue?: string; // YYYY-MM-DD
  approverReviewDue?: string; // YYYY-MM-DD
  tpmSubmissionDue: string; // YYYY-MM-DD

  sentToTpm?: boolean;
  sentToTpmDate?: string; // YYYY-MM-DD
  tpmConfirmedDate?: string; // YYYY-MM-DD
  tpmOutcome?: "approved" | "changes_requested";
  tpmChangeRequest?: string;
  closeRequested?: boolean;

  phaseId: CyclePhaseId;
  forecastPdfHref?: string;
  closed: boolean;
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function iso(y: number, m: number, d: number) {
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function daysInMonth(year: number, monthIndex0: number) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function addMonths(date: Date, n: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), daysInMonth(date.getFullYear(), date.getMonth()));
}

function parseIsoDate(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map((v) => Number(v));
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

function formatIsoDate(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isBusinessDayUtc(date: Date) {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

function subtractBusinessDays(isoDate: string, businessDays: number) {
  let remaining = Math.max(0, Math.floor(businessDays));
  const d = parseIsoDate(isoDate);
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() - 1);
    if (isBusinessDayUtc(d)) remaining -= 1;
  }
  return formatIsoDate(d);
}

function weekdayToJsIndex(weekday: Weekday) {
  // JS: 0=Sunday ... 6=Saturday
  if (weekday === "Sunday") return 0;
  if (weekday === "Monday") return 1;
  if (weekday === "Tuesday") return 2;
  if (weekday === "Wednesday") return 3;
  if (weekday === "Thursday") return 4;
  if (weekday === "Friday") return 5;
  return 6;
}

function computeTpmDueDate(rule: TpmSubmissionScheduleRule, year: number, monthIndex0: number) {
  const dim = daysInMonth(year, monthIndex0);

  if (rule.type === "FixedCalendarDate") {
    const day = Math.min(Math.max(1, Math.floor(rule.dayOfMonth)), dim);
    return iso(year, monthIndex0 + 1, day);
  }

  if (rule.type === "NthWeekdayOfMonth") {
    const target = weekdayToJsIndex(rule.weekday);
    const first = new Date(Date.UTC(year, monthIndex0, 1));
    const offset = (target - first.getUTCDay() + 7) % 7;
    let day = 1 + offset + (rule.nth - 1) * 7;
    while (day > dim) day -= 7;
    day = Math.max(1, day);
    return iso(year, monthIndex0 + 1, day);
  }

  // LastWeekdayOfMonth
  const target = weekdayToJsIndex(rule.weekday);
  const last = new Date(Date.UTC(year, monthIndex0, dim));
  const offset = (last.getUTCDay() - target + 7) % 7;
  const day = dim - offset;
  return iso(year, monthIndex0 + 1, day);
}

function monthAnchorForRecurrence(
  setup: Pick<SetupRow, "recurrence" | "tpmSubmissionSchedule">,
  periodStart: Date,
  periodEnd: Date
) {
  if (setup.recurrence === "Monthly") {
    return { year: periodEnd.getFullYear(), monthIndex0: periodEnd.getMonth() };
  }

  if (setup.recurrence === "Quarterly") {
    const inQuarter = setup.tpmSubmissionSchedule.periodMonthInQuarter ?? 3;
    const offset = Math.max(1, Math.min(3, inQuarter)) - 1;
    const anchor = new Date(periodStart.getFullYear(), periodStart.getMonth() + offset, 1);
    return { year: anchor.getFullYear(), monthIndex0: anchor.getMonth() };
  }

  // Yearly
  const monthOfYear = setup.tpmSubmissionSchedule.periodMonthOfYear ?? 3;
  const desiredMonthIndex0 = Math.max(1, Math.min(12, monthOfYear)) - 1;
  let year = periodStart.getFullYear();

  // Ensure the anchor month lands within the recurrence period.
  if (desiredMonthIndex0 < periodStart.getMonth()) year += 1;

  return { year, monthIndex0: desiredMonthIndex0 };
}

function computeDefaultMilestoneDates(setup: Pick<SetupRow, "defaultBusinessDays">, tpmSubmissionDue: string, cycleStart: string) {
  const defaults = setup.defaultBusinessDays ?? DEFAULT_BUSINESS_DAYS;

  // Defaults are expressed as business-day windows between milestones.
  // - Submission window: review due -> TPM submission due
  // - Review window: preparation due -> review due
  let approverReviewDue = subtractBusinessDays(tpmSubmissionDue, defaults.submission);
  let gspForecastDue = subtractBusinessDays(approverReviewDue, defaults.review);

  // Clamp to cycle window start to avoid generating dates outside the instance period.
  if (gspForecastDue < cycleStart) gspForecastDue = cycleStart;
  if (approverReviewDue < cycleStart) approverReviewDue = cycleStart;

  return { gspForecastDue, approverReviewDue };
}

function monthLabel(date: Date) {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

function quarterLabel(date: Date) {
  const q = Math.floor(date.getMonth() / 3) + 1;
  return `Q${q} ${date.getFullYear()}`;
}

function yearLabel(date: Date) {
  return String(date.getFullYear());
}

function recurrenceStepMonths(recurrence: Recurrence) {
  if (recurrence === "Monthly") return 1;
  if (recurrence === "Quarterly") return 3;
  return 12;
}

function cyclePeriodLabel(recurrence: Recurrence, periodStart: Date) {
  if (recurrence === "Monthly") return monthLabel(periodStart);
  if (recurrence === "Quarterly") return quarterLabel(periodStart);
  return yearLabel(periodStart);
}

export function formatCycleLabel(periodStart: Date, setup: Pick<SetupRow, "tpm" | "products">, recurrence: Recurrence) {
  return `${cyclePeriodLabel(recurrence, periodStart)} - ${setup.tpm} - ${formatProductsLabel(setup.products)} - Forecast`;
}

export function generateCyclesForSetup(
  setup: SetupRow,
  existingCycleIds: string[]
): ForecastCycleRow[] {
  const start = new Date(setup.startDate + "T00:00:00");
  const end = new Date(setup.endDate + "T00:00:00");

  const stepMonths = recurrenceStepMonths(setup.recurrence);
  const cycles: ForecastCycleRow[] = [];

  let cursor = startOfMonth(start);
  const existing = [...existingCycleIds];

  while (cursor <= end) {
    const periodStart = cursor;
    const periodEnd = endOfMonth(addMonths(periodStart, stepMonths - 1));

    if (periodEnd < start) {
      cursor = addMonths(cursor, stepMonths);
      continue;
    }

    if (periodStart > end) break;

    const id = nextCycleId(existing);
    existing.push(id);

    const cycleStartIso = iso(periodStart.getFullYear(), periodStart.getMonth() + 1, 1);
    const cycleEndIso = iso(periodEnd.getFullYear(), periodEnd.getMonth() + 1, periodEnd.getDate());

    const { year, monthIndex0 } = monthAnchorForRecurrence(setup, periodStart, periodEnd);
    const tpmSubmissionDue = computeTpmDueDate(setup.tpmSubmissionSchedule, year, monthIndex0);

    const { gspForecastDue, approverReviewDue } = computeDefaultMilestoneDates(setup, tpmSubmissionDue, cycleStartIso);

    cycles.push({
      id,
      setupId: setup.id,
      label: formatCycleLabel(periodStart, setup, setup.recurrence),
      cycleStart: cycleStartIso,
      cycleEnd: cycleEndIso,
      pillar: setup.pillar,
      tpm: setup.tpm,
      products: setup.products,
      tpmLocation: setup.tpmLocation,
      tpmPreviousCompanyName: setup.tpmPreviousCompanyName,
      assignees: setup.assignees,
      approvers: setup.approvers,
      gspForecastDue,
      approverReviewDue,
      tpmSubmissionDue,
      phaseId: 0,
      closed: false
    });

    cursor = addMonths(cursor, stepMonths);
  }

  return cycles;
}

export function nextCycleId(existingIds: string[]) {
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

function seededCycles(): ForecastCycleRow[] {
  const cycles: ForecastCycleRow[] = [];
  for (const setup of BASE_SETUPS) {
    cycles.push(...generateCyclesForSetup(setup, cycles.map((c) => c.id)));
  }

  // Make a few seeds feel realistic (cover phases 1–5).
  const bySetup = (setupId: string) => cycles.filter((c) => c.setupId === setupId).sort((a, b) => a.cycleStart.localeCompare(b.cycleStart));
  const s1 = bySetup("FS-001");
  const s2 = bySetup("FS-002");

  if (s1[0]) {
    Object.assign(s1[0], {
      requestedBy: "Record Creator",
      requestedDate: "2026-01-03",
      emManagerComments: "Please align assumptions with last cycle and highlight key drivers.",
      phaseId: 4,
      forecastPdfHref: "/sample-forecast.pdf",
      closed: true
    } satisfies Partial<ForecastCycleRow>);
  }

  if (s1[1]) {
    Object.assign(s1[1], {
      requestedBy: "Record Creator",
      requestedDate: "2026-02-03",
      emManagerComments: "Focus on supply constraints and risks.",
      assigneeComments: "Uploaded forecast. Please review the updated assumptions.",
      phaseId: 2,
      closed: false
    } satisfies Partial<ForecastCycleRow>);
  }

  if (s1[2]) {
    Object.assign(s1[2], {
      requestedBy: "Record Creator",
      requestedDate: "2026-03-03",
      emManagerComments: "March cycle created and queued.",
      phaseId: 0,
      closed: false
    } satisfies Partial<ForecastCycleRow>);
  }

  if (s1[3]) {
    Object.assign(s1[3], {
      requestedBy: "Record Creator",
      requestedDate: "2026-04-03",
      emManagerComments: "April cycle scheduled.",
      phaseId: 0,
      closed: false
    } satisfies Partial<ForecastCycleRow>);
  }

  if (s1[4]) {
    Object.assign(s1[4], {
      requestedBy: "Record Creator",
      requestedDate: "2026-05-03",
      emManagerComments: "May cycle scheduled.",
      phaseId: 0,
      closed: false
    } satisfies Partial<ForecastCycleRow>);
  }

  if (s2[0]) {
    Object.assign(s2[0], {
      requestedBy: "Record Creator",
      requestedDate: "2026-01-05",
      emManagerComments: "Q1 kickoff.",
      phaseId: 0,
      closed: false
    } satisfies Partial<ForecastCycleRow>);
  }

  return cycles;
}

export const BASE_CYCLES: ForecastCycleRow[] = seededCycles();
