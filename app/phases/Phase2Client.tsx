"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ForecastCycleRow } from "../../lib/cycles";
import { BASE_CYCLES } from "../../lib/cycles";
import { useSessionCycles } from "../SessionDataProvider";

export function Phase2Client({ cycleId, preview = false }: { cycleId?: string; preview?: boolean }) {
  const router = useRouter();
  const { cyclesById, upsertCycle } = useSessionCycles();

  const cycle = useMemo<ForecastCycleRow | undefined>(() => {
    if (!cycleId) return undefined;
    return cyclesById[cycleId] ?? BASE_CYCLES.find((c) => c.id === cycleId);
  }, [cycleId, cyclesById]);

  const [commentsToAssignees, setCommentsToAssignees] = useState<string>("");

  useEffect(() => {
    setCommentsToAssignees(cycle?.approverCommentsToAssignees ?? "");
  }, [cycleId, cycle?.approverCommentsToAssignees]);

  const saveDraft = () => {
    if (preview) return;
    if (!cycleId) return;
    if (!cycle) return;
    const next: ForecastCycleRow = {
      ...cycle,
      approverCommentsToAssignees: commentsToAssignees || undefined,
      phaseId: 2
    };
    upsertCycle(next);
    router.push("/");
  };

  return (
    <section className="rounded-xl border bg-white p-7 shadow-sm space-y-8">
      {!cycleId ? (
        <div className="rounded-lg border bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Open Phase 3 from an instance row to see details.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 text-base">
        <div className="space-y-1">
          <div className="text-sm font-medium text-slate-700">Forecast file</div>
          <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm text-slate-600">[Link to uploaded forecast file]</div>
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-slate-700">Due dates</div>
          <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Review due: <span className="font-medium">{cycle?.approverReviewDue || "YYYY-MM-DD"}</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium text-slate-700">Assignee comments</div>
        <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {cycle?.assigneeComments?.trim() ? cycle.assigneeComments : <span className="text-slate-500">—</span>}
        </div>
      </div>

      <div className="space-y-3 text-sm">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700">Comments to assignee(s)</label>
          <div className="text-xs text-slate-500">
            If changes are requested by the approver or TPM, ad-hoc meetings or discussions can be held externally (outside this tool) to align.
          </div>
          <textarea
            className="w-full rounded-md border px-3 py-2.5 text-base"
            rows={3}
            placeholder="Summarise any required changes or rationale for approval."
            disabled={preview}
            value={commentsToAssignees}
            onChange={(e) => setCommentsToAssignees(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 text-sm">
          <button
            className="rounded-md border px-4 py-2 text-slate-700 hover:bg-slate-50"
            type="button"
            onClick={saveDraft}
            disabled={preview || !cycleId}
          >
            Save draft
          </button>
          <button
            className="rounded-md border px-4 py-2 text-amber-800 border-amber-300 bg-amber-50 hover:bg-amber-100"
            type="button"
            onClick={() => {
              if (preview) return;
              if (cycleId) router.push(`/phases/1?cycle=${encodeURIComponent(cycleId)}`);
              else router.push("/phases/1");
            }}
            disabled={preview}
          >
            Send back to assignee(s)
          </button>
          <button
            className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
            type="button"
            disabled={preview || !cycleId || !cycle}
            onClick={() => {
              if (preview) return;
              if (!cycleId || !cycle) return;
              upsertCycle({
                ...cycle,
                approverCommentsToAssignees: commentsToAssignees || undefined,
                phaseId: 3
              });
              router.push(`/phases/3?cycle=${encodeURIComponent(cycleId)}`);
            }}
          >
            Approve forecast
          </button>
        </div>
      </div>
    </section>
  );
}
