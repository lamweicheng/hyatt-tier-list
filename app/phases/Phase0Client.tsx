"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { APPROVER_OPTIONS, ASSIGNEE_OPTIONS } from "../../lib/constants";
import type { ForecastCycleRow } from "../../lib/cycles";
import { BASE_CYCLES } from "../../lib/cycles";
import { useSessionCycles, useSessionData } from "../SessionDataProvider";
import { BASE_SETUPS, DEFAULT_BUSINESS_DAYS, type Recurrence, type SetupRow, type TpmSubmissionScheduleRule } from "../../lib/setups";

function todayIso() {
  // Use local calendar date (not UTC) so "today" matches user expectation.
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function ordinal(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n}st`;
  if (mod10 === 2 && mod100 !== 12) return `${n}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${n}rd`;
  return `${n}th`;
}

function describeRule(rule: TpmSubmissionScheduleRule, recurrence: Recurrence) {
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

  if (recurrence === "Monthly") {
    if (rule.type === "FixedCalendarDate") return `${ordinal(rule.dayOfMonth)} of each month`;
    if (rule.type === "NthWeekdayOfMonth") return `${ordinal(rule.nth)} ${rule.weekday} of each month`;
    return `Last ${rule.weekday} of each month`;
  }

  if (recurrence === "Quarterly") {
    const monthInQuarter = rule.periodMonthInQuarter ?? 3;
    const label = monthInQuarter === 1 ? "first" : monthInQuarter === 2 ? "second" : "last";
    if (rule.type === "FixedCalendarDate") return `${ordinal(rule.dayOfMonth)} of the ${label} month of each quarter`;
    if (rule.type === "NthWeekdayOfMonth") return `${ordinal(rule.nth)} ${rule.weekday} of the ${label} month of each quarter`;
    return `Last ${rule.weekday} of the ${label} month of each quarter`;
  }

  const monthOfYear = rule.periodMonthOfYear ?? 3;
  const monthName = MONTH_NAMES[monthOfYear - 1] ?? "March";
  if (rule.type === "FixedCalendarDate") return `${monthName} ${ordinal(rule.dayOfMonth)} of each year`;
  if (rule.type === "NthWeekdayOfMonth") return `${ordinal(rule.nth)} ${rule.weekday} of ${monthName} each year`;
  return `Last ${rule.weekday} of ${monthName} each year`;
}

function parseIsoUtc(isoDate: string) {
  // ISO date in UI is YYYY-MM-DD. Parse as UTC midnight to avoid TZ drift.
  const [y, m, d] = isoDate.split("-").map((v) => Number(v));
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

function diffDays(startIso: string, endIso: string) {
  const start = parseIsoUtc(startIso).getTime();
  const end = parseIsoUtc(endIso).getTime();
  return Math.round((end - start) / (24 * 60 * 60 * 1000));
}

function isBusinessDayUtc(date: Date) {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

function diffBusinessDays(startIso: string, endIso: string) {
  if (startIso === endIso) return 0;
  const forward = endIso > startIso;
  const from = forward ? startIso : endIso;
  const to = forward ? endIso : startIso;

  const d = parseIsoUtc(from);
  const end = parseIsoUtc(to);
  let count = 0;

  // Count business days in (from, to] to align with diffDays behavior.
  while (d.getTime() < end.getTime()) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getTime() > end.getTime()) break;
    if (isBusinessDayUtc(d)) count += 1;
  }

  return forward ? count : -count;
}

export function Phase0Client({ cycleId, preview = false }: { cycleId?: string; preview?: boolean }) {
  const router = useRouter();
  const { cyclesById, upsertCycle } = useSessionCycles();
  const { setupsById } = useSessionData();

  const today = todayIso();

  const existing = useMemo<ForecastCycleRow | undefined>(() => {
    if (!cycleId) return undefined;
    return cyclesById[cycleId] ?? BASE_CYCLES.find((c) => c.id === cycleId);
  }, [cycleId, cyclesById]);

  const setup = useMemo<SetupRow | undefined>(() => {
    const setupId = existing?.setupId;
    if (!setupId) return undefined;
    return setupsById[setupId] ?? BASE_SETUPS.find((s) => s.id === setupId);
  }, [existing?.setupId, setupsById]);

  const suggestedBusinessDays = setup?.defaultBusinessDays ?? DEFAULT_BUSINESS_DAYS;

  const [assigneeInput, setAssigneeInput] = useState<string>("");
  const [assignees, setAssignees] = useState<string[]>(existing?.assignees ?? []);
  const [approverInput, setApproverInput] = useState<string>("");
  const [approvers, setApprovers] = useState<string[]>(existing?.approvers ?? []);
  const [emManagerComments, setEmManagerComments] = useState<string>(existing?.emManagerComments ?? "");
  const [gspForecastDue, setGspForecastDue] = useState<string>(existing?.gspForecastDue ?? todayIso());
  const [approverReviewDue, setApproverReviewDue] = useState<string>(existing?.approverReviewDue ?? todayIso());
  const [tpmSubmissionDue, setTpmSubmissionDue] = useState<string>(existing?.tpmSubmissionDue ?? todayIso());

  useEffect(() => {
    // When switching between instances, reset local edits.
    setAssigneeInput("");
    setApproverInput("");
    setAssignees(existing?.assignees ?? []);
    setApprovers(existing?.approvers ?? []);
    setEmManagerComments(existing?.emManagerComments ?? "");
    setGspForecastDue(existing?.gspForecastDue ?? todayIso());
    setApproverReviewDue(existing?.approverReviewDue ?? todayIso());
    setTpmSubmissionDue(existing?.tpmSubmissionDue ?? todayIso());
  }, [
    cycleId,
    existing?.id,
    existing?.assignees,
    existing?.approvers,
    existing?.emManagerComments,
    existing?.gspForecastDue,
    existing?.approverReviewDue,
    existing?.tpmSubmissionDue
  ]);

  const defaultDueDates = useMemo(() => {
    return {
      gspForecastDue: existing?.gspForecastDue ?? "",
      approverReviewDue: existing?.approverReviewDue ?? "",
      tpmSubmissionDue: existing?.tpmSubmissionDue ?? ""
    };
  }, [existing?.gspForecastDue, existing?.approverReviewDue, existing?.tpmSubmissionDue]);

  const dueDateChanges = useMemo(() => {
    const changes: Array<{ label: string; defaultValue: string; updatedValue: string }> = [];
    if (!cycleId || !existing) return changes;

    if (defaultDueDates.gspForecastDue && gspForecastDue !== defaultDueDates.gspForecastDue) {
      changes.push({
        label: "Assignee forecast due",
        defaultValue: defaultDueDates.gspForecastDue,
        updatedValue: gspForecastDue
      });
    }

    if (defaultDueDates.approverReviewDue && approverReviewDue !== defaultDueDates.approverReviewDue) {
      changes.push({
        label: "Approver review due",
        defaultValue: defaultDueDates.approverReviewDue,
        updatedValue: approverReviewDue
      });
    }

    if (defaultDueDates.tpmSubmissionDue && tpmSubmissionDue !== defaultDueDates.tpmSubmissionDue) {
      changes.push({
        label: "TPM submission due",
        defaultValue: defaultDueDates.tpmSubmissionDue,
        updatedValue: tpmSubmissionDue
      });
    }

    return changes;
  }, [cycleId, existing, defaultDueDates, gspForecastDue, approverReviewDue, tpmSubmissionDue]);

  const updatedTimeline = useMemo(() => {
    if (!gspForecastDue || !approverReviewDue || !tpmSubmissionDue) return null;
    const prepToReviewDays = diffDays(gspForecastDue, approverReviewDue);
    const reviewToTpmDays = diffDays(approverReviewDue, tpmSubmissionDue);
    const todayToPrepDays = diffDays(today, gspForecastDue);
    const todayToPrepBusinessDays = diffBusinessDays(today, gspForecastDue);

    const outOfOrder = prepToReviewDays < 0 || reviewToTpmDays < 0;

    return {
      prepToReviewDays,
      reviewToTpmDays,
      todayToPrepDays,
      todayToPrepBusinessDays,
      outOfOrder
    };
  }, [gspForecastDue, approverReviewDue, tpmSubmissionDue, today]);

  const persist = (nextPhaseId: ForecastCycleRow["phaseId"]) => {
    if (preview) return;
    if (!cycleId) return;
    if (!existing) return;
    upsertCycle({
      ...existing,
      requestedBy: existing.requestedBy ?? "Record Creator",
      requestedDate: existing.requestedDate ?? todayIso(),
      emManagerComments: emManagerComments || undefined,
      assignees: assignees.length ? assignees : undefined,
      approvers: approvers.length ? approvers : undefined,
      gspForecastDue,
      approverReviewDue,
      tpmSubmissionDue,
      phaseId: nextPhaseId
    });
  };

  const addAssignee = () => {
    const next = assigneeInput.trim();
    if (!next) return;
    setAssignees((prev) => (prev.includes(next) ? prev : [...prev, next]));
    setAssigneeInput("");
  };

  const addApprover = () => {
    const next = approverInput.trim();
    if (!next) return;
    setApprovers((prev) => (prev.includes(next) ? prev : [...prev, next]));
    setApproverInput("");
  };

  return (
    <section className="rounded-xl border bg-white p-7 shadow-sm space-y-8">
      {!cycleId ? (
        <div className="rounded-lg border bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Open Phase 1 from an instance in a setup.
        </div>
      ) : null}

      {setup ? (
        <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <span className="font-medium">TPM submission rule:</span> {describeRule(setup.tpmSubmissionSchedule, setup.recurrence)}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 text-base">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Assign assignee(s)</label>
          <div className="flex items-center gap-2">
            <input
              className="w-full rounded-md border px-3 py-2.5 text-base"
              placeholder="Type to search and add"
              value={assigneeInput}
              onChange={(e) => setAssigneeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addAssignee();
                }
              }}
              disabled={!cycleId || preview}
              list="assignee-options"
            />
            <button
              type="button"
              className="rounded-md border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={addAssignee}
              disabled={!cycleId || preview}
            >
              Add
            </button>
            <datalist id="assignee-options">
              {ASSIGNEE_OPTIONS.map((opt) => (
                <option key={opt} value={opt} />
              ))}
            </datalist>
          </div>

          {assignees.length === 0 ? (
            <p className="text-sm text-slate-500">No assignees selected.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {assignees.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-2 rounded-md border bg-slate-50 px-2 py-1 text-[11px] text-slate-700"
                >
                  {name}
                  <button
                    type="button"
                    className="text-slate-500 hover:text-slate-900"
                    onClick={() => setAssignees((prev) => prev.filter((p) => p !== name))}
                    disabled={!cycleId || preview}
                    aria-label={`Remove ${name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Approvers</label>
          <div className="flex items-center gap-2">
            <input
              className="w-full rounded-md border px-3 py-2.5 text-base"
              placeholder="Type to search and add"
              value={approverInput}
              onChange={(e) => setApproverInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addApprover();
                }
              }}
              disabled={!cycleId || preview}
              list="approver-options"
            />
            <button
              type="button"
              className="rounded-md border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={addApprover}
              disabled={!cycleId || preview}
            >
              Add
            </button>
            <datalist id="approver-options">
              {APPROVER_OPTIONS.map((opt) => (
                <option key={opt} value={opt} />
              ))}
            </datalist>
          </div>

          {approvers.length === 0 ? (
            <p className="text-sm text-slate-500">No approvers selected.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {approvers.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-2 rounded-md border bg-slate-50 px-2 py-1 text-[11px] text-slate-700"
                >
                  {name}
                  <button
                    type="button"
                    className="text-slate-500 hover:text-slate-900"
                    onClick={() => setApprovers((prev) => prev.filter((p) => p !== name))}
                    disabled={!cycleId || preview}
                    aria-label={`Remove ${name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 text-base">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Preparation due (assignee forecast)</label>
          <input
            type="date"
            className="w-full rounded-md border px-3 py-2.5 text-base"
            value={gspForecastDue}
            onChange={(e) => setGspForecastDue(e.target.value)}
            disabled={!cycleId || preview}
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Review due (approver review)</label>
          <input
            type="date"
            className="w-full rounded-md border px-3 py-2.5 text-base"
            value={approverReviewDue}
            onChange={(e) => setApproverReviewDue(e.target.value)}
            disabled={!cycleId || preview}
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Submission due (send forecast to TPM)</label>
          <input
            type="date"
            className="w-full rounded-md border px-3 py-2.5 text-base"
            value={tpmSubmissionDue}
            onChange={(e) => setTpmSubmissionDue(e.target.value)}
            disabled={!cycleId || preview}
          />
        </div>
      </div>

      {cycleId ? (
        <div className="rounded-md border bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <div>
            <span className="font-semibold text-slate-900">Preparation time given:</span>{" "}
            {updatedTimeline ? (
              updatedTimeline.todayToPrepDays > 0 ? (
                <>
                  {updatedTimeline.todayToPrepDays} days / {updatedTimeline.todayToPrepBusinessDays} business days (today to preparation due)
                </>
              ) : updatedTimeline.todayToPrepDays === 0 ? (
                <>0 days / 0 business days (preparation due is today)</>
              ) : (
                <>
                  overdue by {Math.abs(updatedTimeline.todayToPrepDays)} days / {Math.abs(updatedTimeline.todayToPrepBusinessDays)} business days (preparation due)
                </>
              )
            ) : (
              <>—</>
            )}
          </div>
          <div className="mt-1 text-[11px] text-slate-600">Suggested preparation time: {suggestedBusinessDays.preparation} business days</div>
        </div>
      ) : null}

      {dueDateChanges.length ? (
        <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <div className="text-xs font-semibold text-slate-900">Updated due dates (this instance)</div>
          <div className="mt-2 grid gap-2">
            {dueDateChanges.map((c) => (
              <div key={c.label} className="rounded-md border bg-white px-3 py-2">
                <div className="text-xs font-medium text-slate-800">{c.label}</div>
                <div className="mt-1 text-xs text-slate-600">
                  Default: <span className="font-medium text-slate-900">{c.defaultValue}</span>
                  <span className="mx-2 text-slate-300">|</span>
                  Updated: <span className="font-medium text-slate-900">{c.updatedValue}</span>
                </div>
              </div>
            ))}
          </div>

          {updatedTimeline ? (
            <div className="mt-3 rounded-md border bg-white px-3 py-2">
              <div className="text-xs font-semibold text-slate-900">Time allocated (updated due dates)</div>
              <div className="mt-1 text-xs text-slate-700">
                Preparation:{" "}
                <span className="font-medium text-slate-900">
                  {updatedTimeline.todayToPrepDays > 0
                    ? `${updatedTimeline.todayToPrepDays} days / ${updatedTimeline.todayToPrepBusinessDays} business days`
                    : updatedTimeline.todayToPrepDays === 0
                      ? "0 days / 0 business days"
                      : `overdue by ${Math.abs(updatedTimeline.todayToPrepDays)} days / ${Math.abs(updatedTimeline.todayToPrepBusinessDays)} business days`}
                </span>{" "}
                to prepare
                <span className="mx-2 text-slate-300">|</span>
                Review: <span className="font-medium text-slate-900">{updatedTimeline.prepToReviewDays} days</span> to review
                <span className="mx-2 text-slate-300">|</span>
                Submission: <span className="font-medium text-slate-900">{updatedTimeline.reviewToTpmDays} days</span> to submit
              </div>

              <div className="mt-1 text-[11px] text-slate-600">
                Suggested timeline: Preparation = {suggestedBusinessDays.preparation} business days to prepare. Review = {suggestedBusinessDays.review} business days to review. Submission = {suggestedBusinessDays.submission} business days to submit. You can update due dates to ensure sufficient time.
              </div>

              {updatedTimeline.outOfOrder ? (
                <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  One or more due dates are out of order (review should be on/after preparation, and TPM submission should be on/after review).
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="text-xs text-slate-500">
        Default milestone dates are auto-populated based on the setup template: Preparation = {suggestedBusinessDays.preparation} business days. Review = {suggestedBusinessDays.review} business days. Submission = {suggestedBusinessDays.submission} business days.
        You can override these dates for this instance without changing the setup template.
        Please ensure to include sufficient buffer days for timezone differences.
      </div>

      <div className="space-y-2 text-base">
        <label className="block text-sm font-medium text-slate-700">Comments</label>
        <textarea
          className="w-full rounded-md border px-3 py-2.5 text-base"
          rows={3}
          placeholder="Add any notes for the assignee(s)."
          value={emManagerComments}
          onChange={(e) => setEmManagerComments(e.target.value)}
          disabled={!cycleId || preview}
        />
      </div>

      <div className="flex justify-end gap-2 text-sm">
        <button
          className="rounded-md border px-4 py-2 text-slate-700 hover:bg-slate-50"
          type="button"
          onClick={() => {
            if (preview) return;
            router.push("/");
          }}
        >
          Cancel
        </button>
        <button
          className="rounded-md border px-4 py-2 text-slate-700 hover:bg-slate-50"
          type="button"
          disabled={!cycleId}
          onClick={() => {
            if (preview) return;
            persist(0);
            router.push("/");
          }}
        >
          Save draft
        </button>
        <button
          className="rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
          type="button"
          disabled={!cycleId}
          onClick={() => {
            if (preview) return;
            persist(1);
            if (cycleId) router.push(`/phases/1?cycle=${encodeURIComponent(cycleId)}`);
          }}
        >
          Initiate forecast instance
        </button>
      </div>
    </section>
  );
}
