"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PILLARS } from "../lib/constants";
import { PHASES } from "../lib/phases";
import { BASE_SETUPS, formatProductsLabel, RECURRENCE_OPTIONS, type SetupRow } from "../lib/setups";
import { BASE_CYCLES, type ForecastCycleRow } from "../lib/cycles";
import { useSessionData } from "./SessionDataProvider";
import { PhaseScreen } from "./phases/PhaseScreen";

type RecurrenceFilterValue = "All" | SetupRow["recurrence"];

type SetupWithCounts = SetupRow & {
  cycleCount: number;
  openCount: number;
  completedCount: number;
};

function mergeById<T extends { id: string }>(base: T[], upsertsById: Record<string, T>) {
  const merged: T[] = base.map((r) => upsertsById[r.id] ?? r);
  const extra = Object.values(upsertsById).filter((r) => !base.some((b) => b.id === r.id));
  return [...merged, ...extra];
}

function isCycleCompleted(c: ForecastCycleRow) {
  return Boolean(c.closed && c.forecastPdfHref);
}

export function SetupsTableClient() {
  const router = useRouter();
  const { setupsById, cyclesById } = useSessionData();

  const [overviewOpen, setOverviewOpen] = useState(false);
  const [screenExamplePhaseId, setScreenExamplePhaseId] = useState<number | null>(null);

  const [pillar, setPillar] = useState<string>("All");
  const [tpm, setTpm] = useState<string>("All");
  const [product, setProduct] = useState<string>("All");
  const [recurrence, setRecurrence] = useState<RecurrenceFilterValue>("All");

  const allSetups = useMemo(() => mergeById(BASE_SETUPS, setupsById), [setupsById]);
  const allCycles = useMemo(() => mergeById(BASE_CYCLES, cyclesById), [cyclesById]);

  const setupsWithCounts = useMemo<SetupWithCounts[]>(() => {
    return allSetups
      .map((s) => {
        const cycles = allCycles.filter((c) => c.setupId === s.id);
        const completedCount = cycles.filter(isCycleCompleted).length;
        const openCount = cycles.length - completedCount;
        return { ...s, cycleCount: cycles.length, openCount, completedCount };
      })
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [allSetups, allCycles]);

  const tpmOptions = useMemo(() => {
    return Array.from(new Set(allSetups.map((s) => s.tpm).filter(Boolean))).sort();
  }, [allSetups]);

  const productOptions = useMemo(() => {
    return Array.from(new Set(allSetups.flatMap((s) => s.products ?? []).filter(Boolean))).sort();
  }, [allSetups]);

  const filtered = useMemo(() => {
    return setupsWithCounts.filter((s) => {
      if (pillar !== "All" && s.pillar !== pillar) return false;
      if (tpm !== "All" && s.tpm !== tpm) return false;
      if (product !== "All" && !(s.products ?? []).includes(product)) return false;
      if (recurrence !== "All" && s.recurrence !== recurrence) return false;
      return true;
    });
  }, [setupsWithCounts, pillar, tpm, product, recurrence]);

  const previewCycleIdForPhase = useMemo(() => {
    const byPhase = new Map<number, string>();
    for (const c of allCycles) {
      if (!byPhase.has(c.phaseId)) byPhase.set(c.phaseId, c.id);
    }
    const fallback = allCycles[0]?.id;
    return (phaseId: number) => byPhase.get(phaseId) ?? fallback;
  }, [allCycles]);

  useEffect(() => {
    if (!overviewOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [overviewOpen]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xl font-semibold text-slate-900">Setups</h3>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOverviewOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border bg-white text-base font-semibold text-slate-700 hover:bg-slate-50"
            aria-label="Process overview information"
            title="Process overview"
          >
            i
          </button>

          <button
            type="button"
            className="rounded-md border bg-white px-5 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => router.push(`/analytics`)}
          >
            Analytics &amp; Reporting
          </button>

          <button
            type="button"
            className="rounded-md bg-slate-900 px-5 py-2.5 text-base font-medium text-white hover:bg-slate-800"
            onClick={() => router.push(`/setups/new`)}
          >
            New Setup
          </button>
        </div>
      </div>

      {overviewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Process overview"
          onMouseDown={() => {
            setOverviewOpen(false);
            setScreenExamplePhaseId(null);
          }}
        >
          <div
            className="flex w-full max-w-3xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-xl border bg-white shadow-sm"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">Process overview</div>
              <button
                type="button"
                className="rounded-md border px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setOverviewOpen(false);
                  setScreenExamplePhaseId(null);
                }}
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 overscroll-contain">
              <div className="text-sm text-slate-600 space-y-2">
                <div>
                  Setups define a recurring forecast template (Pillar, TPM, Products, default assignee(s)/approver(s), cadence, and TPM submission schedule rule).
                </div>
                <div>
                  Each setup generates forecast instances with default due dates automatically populated based on the TPM submission due date anchor.
                </div>
              </div>
              <ol className="space-y-2">
                {PHASES.map((stage) => (
                  <li key={stage.id}>
                    <button
                      type="button"
                      onClick={() => setScreenExamplePhaseId(stage.id)}
                      className={
                        screenExamplePhaseId === stage.id
                          ? "w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-left"
                          : "w-full rounded-lg border px-3 py-2 text-left hover:bg-slate-50"
                      }
                    >
                      <div className="text-sm font-medium text-slate-900">{stage.name}</div>
                      <div className="mt-1 text-sm text-slate-600">{stage.shortDescription}</div>
                    </button>
                  </li>
                ))}
              </ol>

              {screenExamplePhaseId !== null && (
                <div className="pt-2">
                  <div className="text-sm font-semibold text-slate-900">Screen Example</div>
                  <div className="mt-2">
                    <PhaseScreen
                      phaseId={screenExamplePhaseId}
                      phaseName={PHASES.find((p) => p.id === screenExamplePhaseId)?.name}
                      instruction={PHASES.find((p) => p.id === screenExamplePhaseId)?.shortDescription}
                      cycleId={previewCycleIdForPhase(screenExamplePhaseId)}
                      preview
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="grid grid-cols-1 items-end gap-5 sm:grid-cols-2 lg:min-w-max lg:grid-cols-[9rem_9rem_10rem_10rem]">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Pillar</label>
            <select
              className="w-full rounded-md border bg-white px-3 py-2.5 text-base"
              value={pillar}
              onChange={(e) => setPillar(e.target.value)}
            >
              <option value="All">All</option>
              {PILLARS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">TPM</label>
            <select
              className="w-full rounded-md border bg-white px-3 py-2.5 text-base"
              value={tpm}
              onChange={(e) => setTpm(e.target.value)}
            >
              <option value="All">All</option>
              {tpmOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Product</label>
            <select
              className="w-full rounded-md border bg-white px-3 py-2.5 text-base"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
            >
              <option value="All">All</option>
              {productOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Forecast Cadence</label>
            <select
              className="w-full rounded-md border bg-white px-3 py-2.5 text-base"
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as RecurrenceFilterValue)}
            >
              <option value="All">All</option>
              {RECURRENCE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full divide-y">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Pillar</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">TPM</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Products</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Forecast Cadence</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Window</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Instances</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Completed</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((s) => (
              <tr
                key={s.id}
                className="cursor-pointer hover:bg-slate-50"
                onClick={() => router.push(`/setups/${encodeURIComponent(s.id)}`)}
              >
                <td className="px-4 py-3 text-sm text-slate-700">{s.pillar}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{s.tpm}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{formatProductsLabel(s.products)}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{s.recurrence}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{s.startDate} → {s.endDate}</td>
                <td className="px-4 py-3 text-right text-sm text-slate-700">{s.cycleCount}</td>
                <td className="px-4 py-3 text-right text-sm text-slate-700">{s.completedCount}</td>
                <td className="px-4 py-3 text-right text-sm text-slate-700">{s.openCount}</td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={8}>
                  No setups match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
