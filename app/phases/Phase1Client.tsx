"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ForecastCycleRow } from "../../lib/cycles";
import { BASE_CYCLES } from "../../lib/cycles";
import { useSessionCycles } from "../SessionDataProvider";

export function Phase1Client({ cycleId, preview = false }: { cycleId?: string; preview?: boolean }) {
  const router = useRouter();
  const { cyclesById, upsertCycle } = useSessionCycles();
  const [showFeedback, setShowFeedback] = useState(false);

  const cycle = useMemo<ForecastCycleRow | undefined>(() => {
    if (!cycleId) return undefined;
    return cyclesById[cycleId] ?? BASE_CYCLES.find((c) => c.id === cycleId);
  }, [cycleId, cyclesById]);

  const [comments, setComments] = useState<string>("");

  useEffect(() => {
    setComments(cycle?.assigneeComments ?? "");
  }, [cycleId, cycle?.assigneeComments]);

  const saveDraft = () => {
    if (preview) return;
    if (!cycleId) return;
    if (!cycle) return;
    const next: ForecastCycleRow = {
      ...cycle,
      assigneeComments: comments || undefined,
      phaseId: 1
    };
    upsertCycle(next);
    router.push("/");
  };

  return (
    <section className="rounded-xl border bg-white p-7 shadow-sm space-y-8">
      <div className="space-y-4 text-base">
        {cycle?.tpmOutcome === "changes_requested" && cycle?.tpmChangeRequest?.trim() ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <div className="mb-1 text-sm font-medium">TPM requested changes</div>
            <p className="text-sm text-amber-900">{cycle.tpmChangeRequest}</p>
            <p className="mt-1 text-xs text-amber-900/80">
              Update the forecast and re-submit to continue through review &amp; approval.
            </p>
          </div>
        ) : null}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              if (preview) return;
              setShowFeedback((prev) => !prev);
            }}
            className="rounded-md border px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
            disabled={preview}
          >
            {showFeedback ? "Hide reviewer feedback" : "Show reviewer feedback"}
          </button>
        </div>

        {showFeedback && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <div className="mb-1 text-sm font-medium">Reviewer feedback</div>
            <p>Example: Please update assumptions for Q3 and resubmit the forecast.</p>
          </div>
        )}

        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700">Upload prepared forecast file</label>
          <input type="file" className="text-sm" disabled={preview} />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700">Comments</label>
          <textarea
            className="w-full rounded-md border px-3 py-2.5 text-base"
            rows={3}
            placeholder="Add any notes for approvers to review."
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            disabled={preview}
          />
        </div>

        <div className="flex justify-end gap-2 text-sm">
          <button
            className="rounded-md border px-4 py-2 text-slate-700 hover:bg-slate-50"
            type="button"
            disabled={preview || !cycleId}
            onClick={saveDraft}
          >
            Save draft
          </button>
          <button
            className="rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
            type="button"
            disabled={preview}
            onClick={() => {
              if (preview) return;
              if (!cycleId) {
                router.push("/phases/2");
                return;
              }

              if (!cycle) return;

              const next: ForecastCycleRow = {
                ...cycle,
                assigneeComments: comments || undefined,
                phaseId: 2
              };

              upsertCycle(next);
              router.push(`/phases/2?cycle=${encodeURIComponent(cycleId)}`);
            }}
          >
            Submit for Phase 3 review
          </button>
        </div>
      </div>
    </section>
  );
}
