"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { PHASES } from "../../lib/phases";
import {
  BASE_SETUPS,
  DEFAULT_BUSINESS_DAYS,
  formatProductsLabel,
  type Recurrence,
  type TpmSubmissionScheduleRule
} from "../../lib/setups";
import { BASE_CYCLES, type ForecastCycleRow } from "../../lib/cycles";
import { useSessionData } from "../SessionDataProvider";

function mergeById<T extends { id: string }>(base: T[], upsertsById: Record<string, T>) {
  const merged: T[] = base.map((r) => upsertsById[r.id] ?? r);
  const extra = Object.values(upsertsById).filter((r) => !base.some((b) => b.id === r.id));
  return [...merged, ...extra];
}

function phaseLabel(phaseId: ForecastCycleRow["phaseId"]) {
  const phase = PHASES.find((p) => p.id === phaseId);
  return phase ? phase.name : `Phase ${phaseId + 1}`;
}

function currentPhaseBadge(row: ForecastCycleRow) {
  const completed = Boolean(row.closed && row.forecastPdfHref);
  if (completed) {
    return {
      label: "Completed",
      detail: "Forecast PDF available",
      cls: "border-emerald-300 bg-emerald-50 text-emerald-900"
    };
  }

  const phase = phaseLabel(row.phaseId);
  return {
    label: `Phase ${row.phaseId + 1}`,
    detail: phase,
    cls: "border-slate-300 bg-slate-50 text-slate-900"
  };
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

function describeTpmSchedule(rule: TpmSubmissionScheduleRule, recurrence: Recurrence) {
  const ordinal = (n: number) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return `${n}st`;
    if (mod10 === 2 && mod100 !== 12) return `${n}nd`;
    if (mod10 === 3 && mod100 !== 13) return `${n}rd`;
    return `${n}th`;
  };

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

export function SetupDetailClient({ setupId }: { setupId: string }) {
  const router = useRouter();
  const { setupsById, cyclesById } = useSessionData();

  const allSetups = useMemo(() => mergeById(BASE_SETUPS, setupsById), [setupsById]);
  const allCycles = useMemo(() => mergeById(BASE_CYCLES, cyclesById), [cyclesById]);

  const setup = useMemo(() => allSetups.find((s) => s.id === setupId) ?? null, [allSetups, setupId]);

  const cycles = useMemo(() => {
    return allCycles
      .filter((c) => c.setupId === setupId)
      .sort((a, b) => a.cycleStart.localeCompare(b.cycleStart));
  }, [allCycles, setupId]);

  if (!setup) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <div className="text-lg font-semibold text-slate-900">Setup not found</div>
        <div className="mt-1 text-sm text-slate-600">This setup may not exist in the current session.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{setup.pillar} • {setup.tpm} • {formatProductsLabel(setup.products)}</h1>
            <div className="mt-2 text-sm text-slate-700">
              <div>
                <span className="font-medium">Forecast Cadence:</span> {setup.recurrence}
              </div>
              {setup.tpmLocation ? (
                <div>
                  <span className="font-medium">TPM Location:</span> {setup.tpmLocation}
                </div>
              ) : null}
              {setup.tpmPreviousCompanyName ? (
                <div>
                  <span className="font-medium">TPM Previous Company Name (if applicable):</span> {setup.tpmPreviousCompanyName}
                </div>
              ) : null}
              {typeof setup.firmPeriod === "number" ? (
                <div>
                  <span className="font-medium">Firm Period:</span> {setup.firmPeriod}
                </div>
              ) : null}
              {typeof setup.rollingForecastHorizon === "number" ? (
                <div>
                  <span className="font-medium">Rolling Forecast Horizon:</span> {setup.rollingForecastHorizon}
                </div>
              ) : null}
              <div>
                <span className="font-medium">Window:</span> {setup.startDate} → {setup.endDate}
              </div>
              <div>
                <span className="font-medium">TPM submission rule:</span> {describeTpmSchedule(setup.tpmSubmissionSchedule, setup.recurrence)}
              </div>
              <div>
                <span className="font-medium">Default Period to Prepare, Review and Submit Forecast (Business Days):</span>{" "}
                {setup.defaultBusinessDays?.preparation ?? DEFAULT_BUSINESS_DAYS.preparation} preparation, {setup.defaultBusinessDays?.review ?? DEFAULT_BUSINESS_DAYS.review} review, {setup.defaultBusinessDays?.submission ?? DEFAULT_BUSINESS_DAYS.submission} submission
              </div>
            </div>
          </div>

          <div className="text-sm text-slate-700">
            <div>
              <span className="font-medium">Assignee(s):</span> {setup.assignees.join(", ")}
            </div>
            <div className="mt-1">
              <span className="font-medium">Approver(s):</span> {setup.approvers.join(", ")}
            </div>
            <div className="mt-3">
              <button
                type="button"
                className="rounded-md border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => router.push(`/setups/new?edit=${encodeURIComponent(setup.id)}`)}
              >
                Edit setup
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white">
        <table className="min-w-full divide-y">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">Instance</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">Period</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">Forecast Due Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">Current Forecast Phase</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">Forecast File</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {cycles.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-slate-900 whitespace-nowrap">{c.label}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{c.id}</div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">{c.cycleStart} → {c.cycleEnd}</td>
                <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">{c.tpmSubmissionDue}</td>
                <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                  {(() => {
                    const b = currentPhaseBadge(c);
                    return (
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-xs font-semibold ${b.cls}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/phases/${c.phaseId}?cycle=${encodeURIComponent(c.id)}`);
                          }}
                        >
                          {b.label}
                        </button>
                        <span className="text-xs text-slate-600 whitespace-nowrap">{b.detail}</span>
                      </div>
                    );
                  })()}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                  {c.forecastPdfHref ? (
                    <a
                      className="text-slate-900 underline"
                      href={c.forecastPdfHref}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View
                    </a>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}

            {cycles.length === 0 && (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={5}>
                  No instances generated for this setup.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-slate-500">
        Click an instance row to open its phase workflow.
      </div>
    </div>
  );
}
