"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PILLARS, TPM_OPTIONS } from "../../../lib/constants";
import { loadProductCatalog, upsertProductToCatalog } from "../../../lib/productCatalog";
import {
  BASE_SETUPS,
  DEFAULT_BUSINESS_DAYS,
  DEFAULT_TPM_SUBMISSION_SCHEDULE,
  NTH_WEEKDAY_OPTIONS,
  QUARTER_MONTH_IN_PERIOD_OPTIONS,
  RECURRENCE_OPTIONS,
  WEEKDAY_OPTIONS,
  MONTH_OF_YEAR_OPTIONS,
  nextSetupId,
  type MonthOfYear,
  type QuarterMonthInPeriod,
  type NthWeekday,
  type Recurrence,
  type SetupRow,
  type TpmSubmissionScheduleRule,
  type Weekday
} from "../../../lib/setups";
import { BASE_CYCLES, generateCyclesForSetup } from "../../../lib/cycles";
import { useSessionData } from "../../SessionDataProvider";

function mergeById<T extends { id: string }>(base: T[], upsertsById: Record<string, T>) {
  const merged: T[] = base.map((r) => upsertsById[r.id] ?? r);
  const extra = Object.values(upsertsById).filter((r) => !base.some((b) => b.id === r.id));
  return [...merged, ...extra];
}

function splitList(v: string) {
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function ordinal(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n}st`;
  if (mod10 === 2 && mod100 !== 12) return `${n}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${n}rd`;
  return `${n}th`;
}

function dayOfMonthLabel(day: number) {
  const d = Math.floor(day);
  return ordinal(d);
}

function recurrenceNoun(recurrence: Recurrence) {
  if (recurrence === "Monthly") return "Month";
  if (recurrence === "Quarterly") return "Quarter";
  return "Year";
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

function quarterMonthLabel(v: QuarterMonthInPeriod) {
  if (v === 1) return "first";
  if (v === 2) return "second";
  return "last";
}

function describeTpmSchedule(rule: TpmSubmissionScheduleRule, recurrence: Recurrence) {
  if (recurrence === "Monthly") {
    if (rule.type === "FixedCalendarDate") return `${dayOfMonthLabel(rule.dayOfMonth)} of each month`;
    if (rule.type === "NthWeekdayOfMonth") return `${ordinal(rule.nth)} ${rule.weekday} of each month`;
    return `Last ${rule.weekday} of each month`;
  }

  if (recurrence === "Quarterly") {
    const monthInQuarter = (rule.periodMonthInQuarter ?? 3) as QuarterMonthInPeriod;
    const label = quarterMonthLabel(monthInQuarter);
    if (rule.type === "FixedCalendarDate") return `${dayOfMonthLabel(rule.dayOfMonth)} of the ${label} month of each quarter`;
    if (rule.type === "NthWeekdayOfMonth") return `${ordinal(rule.nth)} ${rule.weekday} of the ${label} month of each quarter`;
    return `Last ${rule.weekday} of the ${label} month of each quarter`;
  }

  const monthOfYear = (rule.periodMonthOfYear ?? 3) as MonthOfYear;
  const monthName = MONTH_NAMES[monthOfYear - 1] ?? "March";
  if (rule.type === "FixedCalendarDate") return `${monthName} ${dayOfMonthLabel(rule.dayOfMonth)} of each year`;
  if (rule.type === "NthWeekdayOfMonth") return `${ordinal(rule.nth)} ${rule.weekday} of ${monthName} each year`;
  return `Last ${rule.weekday} of ${monthName} each year`;
}

export function SetupNewClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setupsById, cyclesById, upsertSetup, upsertCycle } = useSessionData();

  const allSetups = useMemo(() => mergeById(BASE_SETUPS, setupsById), [setupsById]);
  const allCycles = useMemo(() => mergeById(BASE_CYCLES, cyclesById), [cyclesById]);

  const editSetupId = searchParams.get("edit");
  const editingSetup = useMemo(() => {
    if (!editSetupId) return null;
    return allSetups.find((s) => s.id === editSetupId) ?? null;
  }, [allSetups, editSetupId]);

  const defaultStart = "2026-01-01";
  const defaultEnd = "2026-12-31";

  const [pillar, setPillar] = useState<SetupRow["pillar"]>(PILLARS[0]);
  const [tpm, setTpm] = useState<(typeof TPM_OPTIONS)[number]>(TPM_OPTIONS[0]);
  const [products, setProducts] = useState<string[]>([]);
  const [productDraft, setProductDraft] = useState("");
  const [productCatalog, setProductCatalog] = useState<string[]>([]);
  const [tpmLocation, setTpmLocation] = useState("");
  const [tpmPreviousCompanyName, setTpmPreviousCompanyName] = useState("");
  const [firmPeriodRaw, setFirmPeriodRaw] = useState("");
  const [rollingForecastHorizonRaw, setRollingForecastHorizonRaw] = useState("");
  const [assigneesRaw, setAssigneesRaw] = useState("GSP Planner A");
  const [approversRaw, setApproversRaw] = useState("Approver A, Approver B");
  const [recurrence, setRecurrence] = useState<Recurrence>("Monthly");
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [error, setError] = useState<string | null>(null);

  const baseProductOptions = useMemo(() => {
    return Array.from(
      new Set(
        allSetups
          .flatMap((s) => s.products ?? [])
          .map((p) => p.trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [allSetups]);

  const productSuggestions = useMemo(() => {
    const q = productDraft.trim().toLowerCase();
    if (!q) return [] as string[];
    const selectedLower = new Set(products.map((p) => p.toLowerCase()));
    return productCatalog
      .filter((p) => p.toLowerCase().includes(q))
      .filter((p) => !selectedLower.has(p.toLowerCase()))
      .slice(0, 8);
  }, [productDraft, productCatalog, products]);

  const [scheduleType, setScheduleType] = useState<TpmSubmissionScheduleRule["type"]>(
    DEFAULT_TPM_SUBMISSION_SCHEDULE.type
  );
  const [fixedDayOfMonth, setFixedDayOfMonth] = useState<number>(
    DEFAULT_TPM_SUBMISSION_SCHEDULE.type === "FixedCalendarDate" ? DEFAULT_TPM_SUBMISSION_SCHEDULE.dayOfMonth : 25
  );
  const [nth, setNth] = useState<NthWeekday>(3);
  const [nthWeekday, setNthWeekday] = useState<Weekday>("Thursday");
  const [lastWeekday, setLastWeekday] = useState<Weekday>("Thursday");
  const [periodMonthInQuarter, setPeriodMonthInQuarter] = useState<QuarterMonthInPeriod>(
    (DEFAULT_TPM_SUBMISSION_SCHEDULE.periodMonthInQuarter ?? 3) as QuarterMonthInPeriod
  );
  const [periodMonthOfYear, setPeriodMonthOfYear] = useState<MonthOfYear>(
    (DEFAULT_TPM_SUBMISSION_SCHEDULE.periodMonthOfYear ?? 3) as MonthOfYear
  );

  const [defaultPreparationBusinessDays, setDefaultPreparationBusinessDays] = useState<number>(
    DEFAULT_BUSINESS_DAYS.preparation
  );
  const [defaultReviewBusinessDays, setDefaultReviewBusinessDays] = useState<number>(DEFAULT_BUSINESS_DAYS.review);
  const [defaultSubmissionBusinessDays, setDefaultSubmissionBusinessDays] = useState<number>(
    DEFAULT_BUSINESS_DAYS.submission
  );

  useEffect(() => {
    if (!editingSetup) return;

    setPillar(editingSetup.pillar);
    setTpm(editingSetup.tpm as (typeof TPM_OPTIONS)[number]);
    setProducts(editingSetup.products ?? []);
    setTpmLocation(editingSetup.tpmLocation ?? "");
    setTpmPreviousCompanyName(editingSetup.tpmPreviousCompanyName ?? "");
    setFirmPeriodRaw(
      typeof editingSetup.firmPeriod === "number" && Number.isFinite(editingSetup.firmPeriod)
        ? String(editingSetup.firmPeriod)
        : ""
    );
    setRollingForecastHorizonRaw(
      typeof editingSetup.rollingForecastHorizon === "number" && Number.isFinite(editingSetup.rollingForecastHorizon)
        ? String(editingSetup.rollingForecastHorizon)
        : ""
    );
    setAssigneesRaw(editingSetup.assignees.join(", "));
    setApproversRaw(editingSetup.approvers.join(", "));
    setRecurrence(editingSetup.recurrence);
    setStartDate(editingSetup.startDate);
    setEndDate(editingSetup.endDate);

    const rule = editingSetup.tpmSubmissionSchedule;
    setScheduleType(rule.type);
    setPeriodMonthInQuarter((rule.periodMonthInQuarter ?? 3) as QuarterMonthInPeriod);
    setPeriodMonthOfYear((rule.periodMonthOfYear ?? 3) as MonthOfYear);
    if (rule.type === "FixedCalendarDate") {
      setFixedDayOfMonth(rule.dayOfMonth);
    }
    if (rule.type === "NthWeekdayOfMonth") {
      setNth(rule.nth);
      setNthWeekday(rule.weekday);
    }
    if (rule.type === "LastWeekdayOfMonth") {
      setLastWeekday(rule.weekday);
    }

    const defaults = editingSetup.defaultBusinessDays ?? DEFAULT_BUSINESS_DAYS;
    setDefaultPreparationBusinessDays(defaults.preparation);
    setDefaultReviewBusinessDays(defaults.review);
    setDefaultSubmissionBusinessDays(defaults.submission);
  }, [editingSetup]);

  useEffect(() => {
    // Load and merge product catalog from localStorage for future selections.
    setProductCatalog(loadProductCatalog(baseProductOptions));
  }, [baseProductOptions]);

  function addProduct(name: string) {
    const v = name.trim();
    if (!v) return;

    setProducts((prev) => {
      if (prev.some((p) => p.toLowerCase() === v.toLowerCase())) return prev;
      return [...prev, v];
    });
    setProductCatalog(upsertProductToCatalog(v, baseProductOptions));
  }

  function removeProduct(name: string) {
    setProducts((prev) => prev.filter((p) => p !== name));
  }

  const tpmSubmissionSchedule: TpmSubmissionScheduleRule = (() => {
    if (scheduleType === "FixedCalendarDate") {
      return { type: "FixedCalendarDate", dayOfMonth: fixedDayOfMonth, periodMonthInQuarter, periodMonthOfYear };
    }
    if (scheduleType === "NthWeekdayOfMonth") {
      return { type: "NthWeekdayOfMonth", nth, weekday: nthWeekday, periodMonthInQuarter, periodMonthOfYear };
    }
    return { type: "LastWeekdayOfMonth", weekday: lastWeekday, periodMonthInQuarter, periodMonthOfYear };
  })();

  const unitLower = recurrenceNoun(recurrence).toLowerCase();
  const periodHint = recurrence === "Monthly" ? "" : ` (defaults to final month of the ${unitLower})`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{editingSetup ? "Edit Setup" : "New Setup"}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Create a forecast template that generates forecast instances (monthly, quarterly, or yearly).
        </p>
      </div>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}

      <div className="rounded-xl border bg-white p-5 space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Pillar</label>
            <select
              className="w-full rounded-md border bg-white px-3 py-2.5 text-base"
              value={pillar}
              onChange={(e) => setPillar(e.target.value as SetupRow["pillar"])}
            >
              {PILLARS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Forecast Cadence</label>
            <select
              className="w-full rounded-md border bg-white px-3 py-2.5 text-base"
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as Recurrence)}
            >
              {RECURRENCE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">TPM Name</label>
            <select
              className="w-full rounded-md border bg-white px-3 py-2.5 text-base"
              value={tpm}
              onChange={(e) => setTpm(e.target.value as (typeof TPM_OPTIONS)[number])}
            >
              {TPM_OPTIONS.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">TPM Previous Company Name (if applicable)</label>
            <input
              className="w-full rounded-md border bg-white px-3 py-2.5 text-base"
              value={tpmPreviousCompanyName}
              onChange={(e) => setTpmPreviousCompanyName(e.target.value)}
              placeholder="e.g., Company X"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">TPM Location</label>
            <input
              className="w-full rounded-md border bg-white px-3 py-2.5 text-base"
              value={tpmLocation}
              onChange={(e) => setTpmLocation(e.target.value)}
              placeholder="e.g., North America"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Products</label>
            <input
              className="w-full rounded-md border bg-white px-3 py-2.5 text-base"
              value={productDraft}
              onChange={(e) => setProductDraft(e.target.value)}
              placeholder="Search or type a product and press Enter"
              list="setup-product-options"
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                addProduct(productDraft);
                setProductDraft("");
              }}
            />
            <datalist id="setup-product-options">
              {productCatalog.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <div className="text-xs text-slate-500">
              Type to search existing products. Press Enter to add. New products are saved for future selections.
            </div>

            {productSuggestions.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {productSuggestions.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="rounded-md border bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      addProduct(p);
                      setProductDraft("");
                    }}
                    title="Add product"
                  >
                    + {p}
                  </button>
                ))}
              </div>
            ) : null}

            {products.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {products.map((p) => (
                  <span key={p} className="inline-flex items-center gap-2 rounded-full border bg-white px-2.5 py-1 text-xs text-slate-700">
                    {p}
                    <button
                      type="button"
                      className="rounded-full border px-1.5 py-0.5 text-xs text-slate-700 hover:bg-slate-50"
                      onClick={() => removeProduct(p)}
                      aria-label={`Remove ${p}`}
                      title="Remove"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Firm Period</label>
            <input
              type="number"
              min={0}
              className="w-full rounded-md border bg-white px-3 py-2.5 text-base"
              value={firmPeriodRaw}
              onChange={(e) => setFirmPeriodRaw(e.target.value)}
              placeholder="(months)"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Rolling Forecast Horizon</label>
            <input
              type="number"
              min={0}
              className="w-full rounded-md border bg-white px-3 py-2.5 text-base"
              value={rollingForecastHorizonRaw}
              onChange={(e) => setRollingForecastHorizonRaw(e.target.value)}
              placeholder="(months)"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Start date</label>
            <input
              type="date"
              className="w-full rounded-md border bg-white px-3 py-2.5 text-base"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">End date</label>
            <input
              type="date"
              className="w-full rounded-md border bg-white px-3 py-2.5 text-base"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-lg border bg-slate-50 p-4 space-y-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">TPM Submission Scheduling Rule</div>
            <div className="mt-1 text-xs text-slate-600">
              Defines the default TPM submission due date anchor for each generated forecast instance.
            </div>
          </div>

          {recurrence === "Quarterly" ? (
            <div className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700">
              <div className="text-xs font-medium text-slate-600">Quarter alignment</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-sm text-slate-600">Apply rule to</span>
                <select
                  className="rounded-md border bg-white px-3 py-2 text-base"
                  value={periodMonthInQuarter}
                  onChange={(e) => setPeriodMonthInQuarter(Number(e.target.value) as QuarterMonthInPeriod)}
                >
                  {QUARTER_MONTH_IN_PERIOD_OPTIONS.map((v) => (
                    <option key={v} value={v}>
                      {v === 1 ? "First month" : v === 2 ? "Second month" : "Last month"}
                    </option>
                  ))}
                </select>
                <span className="text-sm text-slate-600">of each quarter</span>
              </div>
            </div>
          ) : null}

          {recurrence === "Yearly" ? (
            <div className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700">
              <div className="text-xs font-medium text-slate-600">Year alignment</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-sm text-slate-600">Apply rule in</span>
                <select
                  className="rounded-md border bg-white px-3 py-2 text-base"
                  value={periodMonthOfYear}
                  onChange={(e) => setPeriodMonthOfYear(Number(e.target.value) as MonthOfYear)}
                >
                  {MONTH_OF_YEAR_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {MONTH_NAMES[m - 1]}
                    </option>
                  ))}
                </select>
                <span className="text-sm text-slate-600">each year</span>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3">
            <label className="flex items-start gap-3">
              <input
                type="radio"
                name="tpmSchedule"
                className="mt-1"
                checked={scheduleType === "FixedCalendarDate"}
                onChange={() => setScheduleType("FixedCalendarDate")}
              />
              <div className="flex-1 space-y-2">
                <div className="text-sm font-medium text-slate-700">Fixed calendar day of period</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">Day of month{periodHint}</span>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    className="w-24 rounded-md border bg-white px-3 py-2 text-base"
                    value={fixedDayOfMonth}
                    onChange={(e) => setFixedDayOfMonth(Number(e.target.value))}
                  />
                  <span className="text-xs text-slate-500">Example: 25</span>
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3">
              <input
                type="radio"
                name="tpmSchedule"
                className="mt-1"
                checked={scheduleType === "NthWeekdayOfMonth"}
                onChange={() => setScheduleType("NthWeekdayOfMonth")}
              />
              <div className="flex-1 space-y-2">
                <div className="text-sm font-medium text-slate-700">Nth weekday of period</div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-slate-600">Nth</span>
                  <select
                    className="rounded-md border bg-white px-3 py-2 text-base"
                    value={nth}
                    onChange={(e) => setNth(Number(e.target.value) as NthWeekday)}
                  >
                    {NTH_WEEKDAY_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <span className="text-sm text-slate-600">Weekday</span>
                  <select
                    className="rounded-md border bg-white px-3 py-2 text-base"
                    value={nthWeekday}
                    onChange={(e) => setNthWeekday(e.target.value as Weekday)}
                  >
                    {WEEKDAY_OPTIONS.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-slate-500">Example: 3rd Thursday</span>
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3">
              <input
                type="radio"
                name="tpmSchedule"
                className="mt-1"
                checked={scheduleType === "LastWeekdayOfMonth"}
                onChange={() => setScheduleType("LastWeekdayOfMonth")}
              />
              <div className="flex-1 space-y-2">
                <div className="text-sm font-medium text-slate-700">Last weekday of period</div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-slate-600">Weekday</span>
                  <select
                    className="rounded-md border bg-white px-3 py-2 text-base"
                    value={lastWeekday}
                    onChange={(e) => setLastWeekday(e.target.value as Weekday)}
                  >
                    {WEEKDAY_OPTIONS.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-slate-500">Example: Last Thursday</span>
                </div>
              </div>
            </label>
          </div>

          <div className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700">
            <span className="font-medium">Selected default TPM Submission Due Date:</span> {describeTpmSchedule(tpmSubmissionSchedule, recurrence)}
          </div>
        </div>

        <div className="rounded-lg border bg-slate-50 p-4 space-y-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              Default Period to Prepare, Review and Submit Forecast (Business Days)
            </div>
            <div className="mt-1 text-xs text-slate-600">
              TPM submission due is the anchor date. Review due and preparation due are backtracked from that anchor using business days
              (Monday–Friday; no holiday calendar).
              <div className="mt-1">Please ensure to include sufficient buffer days for timezone differences.</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Preparation</label>
              <input
                type="number"
                min={0}
                max={60}
                className="w-full rounded-md border bg-white px-3 py-2.5 text-base"
                value={defaultPreparationBusinessDays}
                onChange={(e) => setDefaultPreparationBusinessDays(Number(e.target.value))}
              />
              <div className="text-xs text-slate-500">Business days for assignees to prepare</div>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Review</label>
              <input
                type="number"
                min={0}
                max={60}
                className="w-full rounded-md border bg-white px-3 py-2.5 text-base"
                value={defaultReviewBusinessDays}
                onChange={(e) => setDefaultReviewBusinessDays(Number(e.target.value))}
              />
              <div className="text-xs text-slate-500">Business days for reviewers to review.</div>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Submission</label>
              <input
                type="number"
                min={0}
                max={60}
                className="w-full rounded-md border bg-white px-3 py-2.5 text-base"
                value={defaultSubmissionBusinessDays}
                onChange={(e) => setDefaultSubmissionBusinessDays(Number(e.target.value))}
              />
              <div className="text-xs text-slate-500">Business days for EM manager to submit to TPM</div>
            </div>
          </div>

          <div className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700">
            <span className="font-medium">Default timeline:</span> Preparation = {defaultPreparationBusinessDays} business days; Review = {defaultReviewBusinessDays} business days; Submission = {defaultSubmissionBusinessDays} business days.
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700">Assignee(s)</label>
          <input
            className="w-full rounded-md border bg-white px-3 py-2.5 text-base"
            value={assigneesRaw}
            onChange={(e) => setAssigneesRaw(e.target.value)}
            placeholder="Comma-separated"
          />
          <div className="text-xs text-slate-500">Comma-separated list.</div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700">Approver(s)</label>
          <input
            className="w-full rounded-md border bg-white px-3 py-2.5 text-base"
            value={approversRaw}
            onChange={(e) => setApproversRaw(e.target.value)}
            placeholder="Comma-separated"
          />
          <div className="text-xs text-slate-500">Comma-separated list.</div>
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            className="rounded-md border bg-white px-4 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => router.push("/")}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-slate-900 px-4 py-2.5 text-base font-medium text-white hover:bg-slate-800"
            onClick={() => {
              setError(null);

              const assignees = splitList(assigneesRaw);
              const approvers = splitList(approversRaw);

              if (!tpm.trim() || products.length === 0) {
                setError("TPM and at least one Product are required.");
                return;
              }
              if (!startDate || !endDate) {
                setError("Start date and end date are required.");
                return;
              }
              if (endDate < startDate) {
                setError("End date must be on/after the start date.");
                return;
              }
              if (assignees.length === 0) {
                setError("At least one assignee is required.");
                return;
              }
              if (approvers.length === 0) {
                setError("At least one approver is required.");
                return;
              }

              const id = editingSetup ? editingSetup.id : nextSetupId(allSetups.map((s) => s.id));
              const firmPeriodParsed = firmPeriodRaw.trim() === "" ? null : Number(firmPeriodRaw);
              const rollingForecastHorizonParsed = rollingForecastHorizonRaw.trim() === "" ? null : Number(rollingForecastHorizonRaw);

              const setup: SetupRow = {
                id,
                pillar,
                tpm: tpm.trim(),
                products: products.map((p) => p.trim()).filter(Boolean),
                tpmLocation: tpmLocation.trim() ? tpmLocation.trim() : undefined,
                tpmPreviousCompanyName: tpmPreviousCompanyName.trim() ? tpmPreviousCompanyName.trim() : undefined,
                firmPeriod:
                  typeof firmPeriodParsed === "number" && Number.isFinite(firmPeriodParsed)
                    ? Math.max(0, Math.floor(firmPeriodParsed))
                    : null,
                rollingForecastHorizon:
                  typeof rollingForecastHorizonParsed === "number" && Number.isFinite(rollingForecastHorizonParsed)
                    ? Math.max(0, Math.floor(rollingForecastHorizonParsed))
                  : null,
                assignees,
                approvers,
                recurrence,
                startDate,
                endDate,
                tpmSubmissionSchedule,
                defaultBusinessDays: {
                  preparation: Math.max(0, Math.floor(defaultPreparationBusinessDays)),
                  review: Math.max(0, Math.floor(defaultReviewBusinessDays)),
                  submission: Math.max(0, Math.floor(defaultSubmissionBusinessDays))
                }
              };

              upsertSetup(setup);

              // For new setups, generate instances immediately.
              // For edits, we only update the template; existing instances remain unchanged unless manually edited.
              if (!editingSetup) {
                const cycles = generateCyclesForSetup(setup, allCycles.map((c) => c.id));
                for (const c of cycles) upsertCycle(c);
              }

              router.push(`/setups/${encodeURIComponent(id)}`);
            }}
          >
            {editingSetup ? "Save changes" : "Create Setup"}
          </button>
        </div>
      </div>
    </div>
  );
}
