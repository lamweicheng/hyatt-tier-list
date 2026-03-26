"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BASE_CYCLES, type ForecastCycleRow } from "../../lib/cycles";
import { BASE_SETUPS, formatProductsLabel, type SetupRow } from "../../lib/setups";
import { PHASES } from "../../lib/phases";
import { useSessionData } from "../SessionDataProvider";

function mergeById<T extends { id: string }>(base: T[], upsertsById: Record<string, T>) {
  const merged: T[] = base.map((r) => upsertsById[r.id] ?? r);
  const extra = Object.values(upsertsById).filter((r) => !base.some((b) => b.id === r.id));
  return [...merged, ...extra];
}

function isCycleCompleted(c: ForecastCycleRow) {
  return Boolean(c.closed && c.forecastPdfHref);
}

function downloadTextFile(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

function csvEscape(value: unknown) {
  const s = String(value ?? "");
  if (/[\n\r",]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function setupsToCsv(rows: SetupRow[]) {
  const header = [
    "pillar",
    "tpm",
    "products",
    "recurrence",
    "startDate",
    "endDate",
    "assignees",
    "approvers"
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.pillar,
        r.tpm,
        formatProductsLabel(r.products),
        r.recurrence,
        r.startDate,
        r.endDate,
        r.assignees.join("; "),
        r.approvers.join("; ")
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  return lines.join("\n");
}

function cyclesToCsv(rows: ForecastCycleRow[]) {
  const header = [
    "label",
    "instanceStart",
    "instanceEnd",
    "pillar",
    "tpm",
    "products",
    "phaseId",
    "tpmSubmissionDue",
    "approverReviewDue",
    "gspForecastDue",
    "closed",
    "forecastPdfHref"
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.label,
        r.cycleStart,
        r.cycleEnd,
        r.pillar,
        r.tpm,
        formatProductsLabel(r.products),
        r.phaseId,
        r.tpmSubmissionDue,
        r.approverReviewDue ?? "",
        r.gspForecastDue ?? "",
        String(r.closed),
        r.forecastPdfHref ?? ""
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  return lines.join("\n");
}

type PhaseStat = { phaseId: number; name: string; openCount: number; totalCount: number };

type RollupRow = {
  key: string;
  setups: number;
  cycles: number;
  completed: number;
  overdue: number;
};

export function AnalyticsClient() {
  const { setupsById, cyclesById } = useSessionData();

  const allSetups = useMemo(() => mergeById(BASE_SETUPS, setupsById), [setupsById]);
  const allCycles = useMemo(() => mergeById(BASE_CYCLES, cyclesById), [cyclesById]);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const thisMonthKey = useMemo(() => todayIso.slice(0, 7), [todayIso]);
  const [selectedMonth, setSelectedMonth] = useState<string>(thisMonthKey); // YYYY-MM or 'all'

  function monthRangeForKey(yyyyMm: string) {
    const [y, m] = yyyyMm.split("-").map((v) => Number(v));
    const start = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-01`;
    const endDate = new Date(Date.UTC(y, m, 0));
    const end = `${endDate.getUTCFullYear()}-${String(endDate.getUTCMonth() + 1).padStart(2, "0")}-${String(endDate.getUTCDate()).padStart(2, "0")}`;
    return { start, end };
  }

  function isoInMonth(isoDate: string | undefined, yyyyMm: string) {
    if (!isoDate) return false;
    const [y, m] = yyyyMm.split("-");
    return isoDate.startsWith(`${y}-${m}-`);
  }

  const monthOptions = useMemo(() => {
    const keys = new Set<string>();
    keys.add(thisMonthKey);
    for (const c of allCycles) {
      keys.add(c.cycleStart.slice(0, 7));
      if (c.tpmSubmissionDue) keys.add(c.tpmSubmissionDue.slice(0, 7));
      if (c.approverReviewDue) keys.add(c.approverReviewDue.slice(0, 7));
      if (c.gspForecastDue) keys.add(c.gspForecastDue.slice(0, 7));
    }
    const arr = Array.from(keys).sort((a, b) => b.localeCompare(a));
    return arr;
  }, [allCycles, thisMonthKey]);

  const filteredCycles = useMemo(() => {
    const matches = (c: ForecastCycleRow) => {
      if (selectedMonth === "all") return true;
      const { start, end } = monthRangeForKey(selectedMonth);
      if (!(c.cycleStart <= end && c.cycleEnd >= start)) {
        if (isoInMonth(c.tpmSubmissionDue, selectedMonth)) return true;
        if (isoInMonth(c.approverReviewDue, selectedMonth)) return true;
        if (isoInMonth(c.gspForecastDue, selectedMonth)) return true;
        return false;
      }
      return true;
    };

    return allCycles.filter((c) => matches(c));
  }, [allCycles, selectedMonth]);

  const kpis = useMemo(() => {
    const setupCount = allSetups.length;
    const cycleCount = filteredCycles.length;
    const completedCount = filteredCycles.filter(isCycleCompleted).length;
    const openCount = cycleCount - completedCount;
    const overdueCount = filteredCycles.filter((c) => !isCycleCompleted(c) && c.tpmSubmissionDue < todayIso).length;
    const onTimeRate = cycleCount === 0 ? 0 : Math.round(((cycleCount - overdueCount) / cycleCount) * 100);

    return {
      setupCount,
      cycleCount,
      completedCount,
      openCount,
      overdueCount,
      onTimeRate
    };
  }, [allSetups.length, filteredCycles, todayIso]);

  const phaseStats = useMemo<PhaseStat[]>(() => {
    const totalByPhase = new Map<number, number>();
    const openByPhase = new Map<number, number>();

    for (const c of filteredCycles) {
      totalByPhase.set(c.phaseId, (totalByPhase.get(c.phaseId) ?? 0) + 1);
      if (!isCycleCompleted(c)) {
        openByPhase.set(c.phaseId, (openByPhase.get(c.phaseId) ?? 0) + 1);
      }
    }

    return PHASES.map((p) => {
      return {
        phaseId: p.id,
        name: p.name,
        openCount: openByPhase.get(p.id) ?? 0,
        totalCount: totalByPhase.get(p.id) ?? 0
      };
    });
  }, [filteredCycles]);

  const upcomingDue = useMemo(() => {
    return filteredCycles
      .filter((c) => !isCycleCompleted(c))
      .map((c) => {
        const due = c.tpmSubmissionDue;
        const urgency = due < todayIso ? "Overdue" : due <= todayIso ? "Due" : "Upcoming";
        return { id: c.id, label: c.label, due, urgency, setupId: c.setupId };
      })
      .sort((a, b) => a.due.localeCompare(b.due))
      .slice(0, 10);
  }, [filteredCycles, todayIso]);

  const byPillar = useMemo(() => {
    const map = new Map<string, RollupRow>();
    for (const s of allSetups) {
      if (!map.has(s.pillar)) map.set(s.pillar, { key: s.pillar, setups: 0, cycles: 0, completed: 0, overdue: 0 });
      map.get(s.pillar)!.setups += 1;
    }
    for (const c of filteredCycles) {
      if (!map.has(c.pillar)) map.set(c.pillar, { key: c.pillar, setups: 0, cycles: 0, completed: 0, overdue: 0 });
      const row = map.get(c.pillar)!;
      row.cycles += 1;
      if (isCycleCompleted(c)) row.completed += 1;
      if (!isCycleCompleted(c) && c.tpmSubmissionDue < todayIso) row.overdue += 1;
    }
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [allSetups, filteredCycles, todayIso]);

  const byProduct = useMemo(() => {
    const map = new Map<string, RollupRow>();
    for (const s of allSetups) {
      for (const p of s.products ?? []) {
        if (!map.has(p)) map.set(p, { key: p, setups: 0, cycles: 0, completed: 0, overdue: 0 });
        map.get(p)!.setups += 1;
      }
    }
    for (const c of filteredCycles) {
      for (const p of c.products ?? []) {
        if (!map.has(p)) map.set(p, { key: p, setups: 0, cycles: 0, completed: 0, overdue: 0 });
        const row = map.get(p)!;
        row.cycles += 1;
        if (isCycleCompleted(c)) row.completed += 1;
        if (!isCycleCompleted(c) && c.tpmSubmissionDue < todayIso) row.overdue += 1;
      }
    }
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [allSetups, filteredCycles, todayIso]);

  // Risk register removed per request.

  const maxPhaseTotal = Math.max(1, ...phaseStats.map((p) => p.totalCount));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-slate-600">
          <div className="font-medium text-slate-900">Dashboard</div>
          <div>Calculated from the current in-session data.</div>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-600">Period:</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="all">All months</option>
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {m === thisMonthKey ? `${m} (this month)` : m}
              </option>
            ))}
          </select>
          <Link
            href="/"
            className="rounded-md border bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to Setups
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Setups</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{kpis.setupCount}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Instances</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{kpis.cycleCount}</div>
          <div className="mt-1 text-sm text-slate-600">{kpis.openCount} open • {kpis.completedCount} completed</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Overdue</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{kpis.overdueCount}</div>
          <div className="mt-1 text-sm text-slate-600">On-time rate: {kpis.onTimeRate}%</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">Phase distribution</div>
            <div className="text-xs text-slate-500">Open / Total</div>
          </div>

          <div className="mt-4 space-y-3">
            {phaseStats.map((p) => {
              const width = Math.round((p.totalCount / maxPhaseTotal) * 100);
              return (
                <div key={p.phaseId} className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-slate-700">{p.name}</div>
                    <div className="text-sm text-slate-700">{p.openCount} / {p.totalCount}</div>
                  </div>
                  <div className="h-2 w-full rounded bg-slate-100">
                    <div className="h-2 rounded bg-slate-900" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 text-xs text-slate-500">
            Forecast accuracy &amp; bias are not calculated in this mock-up (no actuals dataset).
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-900">Upcoming due dates</div>
            <div className="text-xs text-slate-500">Top 10</div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Instance</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Due</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {upcomingDue.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-sm text-slate-700">
                      <Link href={`/setups/${encodeURIComponent(d.setupId)}`} className="text-slate-900 hover:underline">
                        {d.label}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-700">{d.due}</td>
                    <td className="px-3 py-2 text-sm">
                      <span
                        className={
                          d.urgency === "Overdue"
                            ? "rounded-full bg-slate-900 px-2 py-1 text-xs font-medium text-white"
                            : "rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700"
                        }
                      >
                        {d.urgency}
                      </span>
                    </td>
                  </tr>
                ))}

                {upcomingDue.length === 0 && (
                  <tr>
                    <td className="px-3 py-10 text-center text-sm text-slate-500" colSpan={3}>
                      No open instances.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Reporting by pillar</div>
            <div className="mt-1 text-sm text-slate-600">Setups and instances rollups for management reporting.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-md border bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => downloadTextFile("setups.csv", setupsToCsv(allSetups), "text/csv")}
            >
              Export Setups (CSV)
            </button>
            <button
              type="button"
              className="rounded-md border bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => downloadTextFile("instances.csv", cyclesToCsv(filteredCycles), "text/csv")}
            >
              Export Instances (CSV)
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Pillar</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Setups</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Instances</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Completed</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Overdue</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {byPillar.map((r) => (
                <tr key={r.key} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-sm text-slate-700">{r.key}</td>
                  <td className="px-3 py-2 text-right text-sm text-slate-700">{r.setups}</td>
                  <td className="px-3 py-2 text-right text-sm text-slate-700">{r.cycles}</td>
                  <td className="px-3 py-2 text-right text-sm text-slate-700">{r.completed}</td>
                  <td className="px-3 py-2 text-right text-sm text-slate-700">{r.overdue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-4">
          <div className="text-sm font-semibold text-slate-900">Reporting by product</div>
          <div className="mt-1 text-sm text-slate-600">Completion and overdue rollups for product-level views.</div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Product</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Setups</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Instances</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Completed</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Overdue</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {byProduct.map((r) => (
                  <tr key={r.key} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-sm text-slate-700">{r.key}</td>
                    <td className="px-3 py-2 text-right text-sm text-slate-700">{r.setups}</td>
                    <td className="px-3 py-2 text-right text-sm text-slate-700">{r.cycles}</td>
                    <td className="px-3 py-2 text-right text-sm text-slate-700">{r.completed}</td>
                    <td className="px-3 py-2 text-right text-sm text-slate-700">{r.overdue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Risk register removed per request */}
      </div>
    </div>
  );
}
