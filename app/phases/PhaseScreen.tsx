"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Phase0Client } from "./Phase0Client";
import { Phase1Client } from "./Phase1Client";
import { Phase2Client } from "./Phase2Client";
import { PHASES } from "../../lib/phases";
import { BASE_CYCLES, type ForecastCycleRow } from "../../lib/cycles";
import { formatProductsLabel } from "../../lib/setups";
import { useSessionCycles } from "../SessionDataProvider";

function periodLabelFromCycle(cycle?: ForecastCycleRow) {
  const raw = cycle?.label ?? "";
  const period = raw.split(" - ")[0]?.trim();
  if (period) return period;
  if (cycle?.cycleStart && cycle?.cycleEnd) return `${cycle.cycleStart} → ${cycle.cycleEnd}`;
  return "—";
}

export function PhaseScreen({
  phaseId,
  cycleId,
  phaseName,
  instruction,
  enablePhasePeek = true,
  progressPhaseIdOverride,
  preview = false
}: {
  phaseId: number;
  cycleId?: string;
  phaseName?: string;
  instruction?: string;
  enablePhasePeek?: boolean;
  progressPhaseIdOverride?: number;
  preview?: boolean;
}) {
  const { cyclesById } = useSessionCycles();
  const [peekPhaseId, setPeekPhaseId] = useState<number | null>(null);
  const cycle: ForecastCycleRow | undefined = cycleId
    ? cyclesById[cycleId] ?? BASE_CYCLES.find((c) => c.id === cycleId)
    : undefined;
  const lastPhaseId = PHASES.length - 1;

  const recordBanner = cycleId ? (
    <div className="rounded-lg border bg-white px-4 py-3 shadow-sm text-base text-slate-700">
      <span className="text-sm font-semibold text-slate-900">{cycleId}</span>
      <span className="mx-2 text-slate-300">|</span>
      <span className="font-medium text-slate-900 text-sm">Period:</span>{" "}
      <span className="text-sm font-semibold text-slate-900">{periodLabelFromCycle(cycle)}</span>
      <span className="mx-2 text-slate-300">|</span>
      <span className="font-medium text-slate-900 text-sm">Pillar:</span>{" "}
      <span className="text-sm font-semibold text-slate-900">{cycle?.pillar ?? "—"}</span>
      <span className="mx-2 text-slate-300">|</span>
      <span className="font-medium text-slate-900 text-sm">TPM Name:</span>{" "}
      <span className="text-sm font-semibold text-slate-900">{cycle?.tpm || "—"}</span>
      {cycle?.tpmLocation ? (
        <>
          <span className="mx-2 text-slate-300">|</span>
          <span className="font-medium text-slate-900 text-sm">TPM Location:</span>{" "}
          <span className="text-sm font-semibold text-slate-900">{cycle.tpmLocation}</span>
        </>
      ) : null}
      <span className="mx-2 text-slate-300">|</span>
      <span className="font-medium text-slate-900 text-sm">Products:</span>{" "}
      <span className="text-sm font-semibold text-slate-900">{cycle ? (formatProductsLabel(cycle.products) || "—") : "—"}</span>
    </div>
  ) : null;

  const actualCurrentPhaseId = Math.min(cycle?.phaseId ?? phaseId, lastPhaseId);
  const displayPhaseId = Math.min(progressPhaseIdOverride ?? actualCurrentPhaseId, lastPhaseId);
  const canPeek = Boolean(enablePhasePeek && !preview && cycleId && cycle && actualCurrentPhaseId > 0);

  const content = (() => {
    if (phaseId === 0) {
      return <Phase0Client cycleId={cycleId} preview={preview} />;
    }

    if (phaseId === 1) {
      return <Phase1Client cycleId={cycleId} preview={preview} />;
    }

    if (phaseId === 2) {
      return <Phase2Client cycleId={cycleId} preview={preview} />;
    }

    if (phaseId === 3) {
      return <Phase3Client cycleId={cycleId} cycle={cycle} preview={preview} />;
    }

    if (phaseId === 4) {
      return <Phase4Client cycleId={cycleId} cycle={cycle} preview={preview} />;
    }

    return null;
  })();

  return (
    <div className="space-y-4">
      {recordBanner}
      <PhaseProgress
        currentPhaseId={displayPhaseId}
        phaseName={phaseName}
        instruction={instruction}
        clickableUpTo={canPeek ? actualCurrentPhaseId : undefined}
        onPhaseClick={canPeek ? (id) => setPeekPhaseId(id) : undefined}
      />
      {cycle && cycleId && phaseId !== 0 ? <CycleInfoCard cycle={cycle} /> : null}
      {content}

      {peekPhaseId !== null && cycleId && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Phase details"
          onMouseDown={() => setPeekPhaseId(null)}
        >
          <div
            className="flex w-full max-w-4xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-xl border bg-white shadow-sm"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">
                {PHASES.find((p) => p.id === peekPhaseId)?.name ?? `Phase ${peekPhaseId + 1}`}
              </div>
              <button
                type="button"
                className="rounded-md border px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                onClick={() => setPeekPhaseId(null)}
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 overscroll-contain">
              <PhaseScreen
                phaseId={peekPhaseId}
                cycleId={cycleId}
                phaseName={PHASES.find((p) => p.id === peekPhaseId)?.name}
                instruction={PHASES.find((p) => p.id === peekPhaseId)?.shortDescription}
                preview
                enablePhasePeek={false}
                progressPhaseIdOverride={peekPhaseId}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PhaseProgress({
  currentPhaseId,
  phaseName,
  instruction,
  clickableUpTo,
  onPhaseClick
}: {
  currentPhaseId: number;
  phaseName?: string;
  instruction?: string;
  clickableUpTo?: number;
  onPhaseClick?: (phaseId: number) => void;
}) {
  return (
    <div className="rounded-xl border bg-white px-4 py-3 shadow-sm">
      {phaseName ? <div className="mb-2 text-lg font-semibold text-slate-900">{phaseName}</div> : null}
      <div className="flex flex-wrap items-center gap-2">
        {PHASES.map((_, idx) => {
          const done = idx < currentPhaseId;
          const current = idx === currentPhaseId;
          const cls = done
            ? "border-emerald-600 bg-emerald-600 text-white"
            : current
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-slate-200 bg-slate-50 text-slate-500";

          const isClickable = typeof clickableUpTo === "number" && idx <= clickableUpTo && Boolean(onPhaseClick);

          const bubble = (
            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold ${cls}`}>
              {idx + 1}
            </span>
          );

          return (
            <div key={idx} className="flex items-center gap-2">
              {isClickable ? (
                <button
                  type="button"
                  onClick={() => onPhaseClick?.(idx)}
                  className="rounded-full disabled:cursor-not-allowed"
                  aria-label={`View Phase ${idx + 1}`}
                >
                  {bubble}
                </button>
              ) : (
                bubble
              )}
              {idx < PHASES.length - 1 ? <div className="h-px w-8 bg-slate-200" /> : null}
            </div>
          );
        })}
      </div>
      {phaseName ? null : (
        <div className="mt-2 text-xs text-slate-600">
          {`Currently in Phase ${currentPhaseId + 1}`}
        </div>
      )}
      {instruction ? <div className="mt-1 text-base text-slate-700">{instruction}</div> : null}
    </div>
  );
}

function CycleInfoCard({ cycle }: { cycle: ForecastCycleRow }) {
  const assigneesText = cycle.assignees?.length ? cycle.assignees.join(", ") : "—";
  const requestedBy = cycle.requestedBy || "—";
  const requestedDate = cycle.requestedDate || "—";
  const gspForecastDue = cycle.gspForecastDue || "—";
  const approverReviewDue = cycle.approverReviewDue || "—";
  const sendToTpmDue = cycle.tpmSubmissionDue || "—";

  return (
    <section className="rounded-xl border bg-white p-7 shadow-sm space-y-4">
      <div className="text-sm font-semibold text-slate-900">Instance information</div>
      <div className="grid gap-3 md:grid-cols-2 text-base">
        <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <div>
            Assignee(s): <span className="font-medium">{assigneesText}</span>
          </div>
          <div>
            Requested by: <span className="font-medium">{requestedBy}</span>
          </div>
          <div>
            Date requested: <span className="font-medium">{requestedDate}</span>
          </div>
        </div>
        <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <div>
            Forecast submission to EM due: <span className="font-medium">{gspForecastDue}</span>
          </div>
          <div>
            Review and approval due: <span className="font-medium">{approverReviewDue}</span>
          </div>
          <div>
            Send to TPM due: <span className="font-medium">{sendToTpmDue}</span>
          </div>
        </div>
      </div>

      <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm text-slate-700">
        <div className="mb-1 text-sm font-medium text-slate-700">Comments from record creator</div>
        {cycle.emManagerComments?.trim() ? cycle.emManagerComments : <span className="text-slate-500">—</span>}
      </div>
    </section>
  );
}

function baseCycleForPhase(cycleId: string, phaseId: ForecastCycleRow["phaseId"]): ForecastCycleRow {
  return {
    id: cycleId,
    setupId: "",
    label: "",
    cycleStart: "",
    cycleEnd: "",
    pillar: "Aseptic" as ForecastCycleRow["pillar"],
    tpm: "",
    products: [],
    tpmLocation: undefined,
    tpmPreviousCompanyName: undefined,
    tpmSubmissionDue: "",
    phaseId,
    closed: false
  };
}

function Phase3Client({
  cycleId,
  cycle,
  preview
}: {
  cycleId?: string;
  cycle?: ForecastCycleRow;
  preview?: boolean;
}) {
  const router = useRouter();
  const { upsertCycle } = useSessionCycles();

  const [sentToTpm, setSentToTpm] = useState<boolean>(Boolean(cycle?.sentToTpm));
  const [sentToTpmDate, setSentToTpmDate] = useState<string>(cycle?.sentToTpmDate ?? "");

  useEffect(() => {
    setSentToTpm(Boolean(cycle?.sentToTpm));
    setSentToTpmDate(cycle?.sentToTpmDate ?? "");
  }, [cycleId, cycle?.sentToTpm, cycle?.sentToTpmDate]);

  const persist = (nextPhaseId: ForecastCycleRow["phaseId"]) => {
    if (preview) return;
    if (!cycleId) return;
    const next: ForecastCycleRow = {
      ...(cycle ?? baseCycleForPhase(cycleId, 3)),
      id: cycleId,
      sentToTpm: sentToTpm || undefined,
      sentToTpmDate: sentToTpmDate || undefined,
      phaseId: nextPhaseId
    };
    upsertCycle(next);
  };

  return (
    <section className="rounded-xl border bg-white p-7 shadow-sm space-y-8">
      <div className="space-y-2 text-base">
        <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Status: <span className="font-medium">Approved in Phase 3 – ready to send to TPM</span>
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-slate-700">Approved forecast file</div>
          <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm text-slate-600">
            [Link / button to download approved forecast file]
          </div>
        </div>
      </div>

      <div className="space-y-4 text-base">
        <div className="flex items-center gap-3">
          <input
            id="sentToTpm"
            type="checkbox"
            className="h-4 w-4"
            disabled={preview}
            checked={sentToTpm}
            onChange={(e) => setSentToTpm(e.target.checked)}
          />
          <label htmlFor="sentToTpm" className="text-sm text-slate-800">
            I have sent the forecast file to TPM via Outlook
          </label>
        </div>
        <div className="space-y-1 max-w-xs">
          <label className="block text-sm font-medium text-slate-700">Date email was sent</label>
          <input
            type="date"
            className="w-full rounded-md border px-3 py-2 text-base"
            disabled={preview}
            value={sentToTpmDate}
            onChange={(e) => setSentToTpmDate(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 text-sm">
          <button
            type="button"
            className="rounded-md border px-4 py-2 text-slate-700 hover:bg-slate-50"
            disabled={preview || !cycleId}
            onClick={() => {
              persist(3);
              router.push("/");
            }}
          >
            Save draft
          </button>
          <button
            type="button"
            className={
              preview
                ? "rounded-md bg-slate-900 px-4 py-2 text-white opacity-60"
                : "rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
            }
            disabled={preview}
            onClick={() => {
              if (preview) return;
              persist(4);
              if (cycleId) router.push(`/phases/4?cycle=${encodeURIComponent(cycleId)}`);
              else router.push("/phases/4");
            }}
          >
            Proceed to Phase 5
          </button>
        </div>
      </div>
    </section>
  );
}

function Phase4Client({
  cycleId,
  cycle,
  preview
}: {
  cycleId?: string;
  cycle?: ForecastCycleRow;
  preview?: boolean;
}) {
  const router = useRouter();
  const { upsertCycle } = useSessionCycles();

  const [tpmConfirmedDate, setTpmConfirmedDate] = useState<string>(cycle?.tpmConfirmedDate ?? "");
  const [tpmOutcome, setTpmOutcome] = useState<"approved" | "changes_requested">(
    cycle?.tpmOutcome ?? "approved"
  );
  const [tpmChangeRequest, setTpmChangeRequest] = useState<string>(cycle?.tpmChangeRequest ?? "");

  useEffect(() => {
    setTpmConfirmedDate(cycle?.tpmConfirmedDate ?? "");
    setTpmOutcome(cycle?.tpmOutcome ?? "approved");
    setTpmChangeRequest(cycle?.tpmChangeRequest ?? "");
  }, [cycleId, cycle?.tpmConfirmedDate, cycle?.tpmOutcome, cycle?.tpmChangeRequest]);

  const persist = (nextPhaseId: ForecastCycleRow["phaseId"]) => {
    if (preview) return;
    if (!cycleId) return;
    const next: ForecastCycleRow = {
      ...(cycle ?? baseCycleForPhase(cycleId, 4)),
      id: cycleId,
      tpmConfirmedDate: tpmConfirmedDate || undefined,
      tpmOutcome,
      tpmChangeRequest: tpmOutcome === "changes_requested" ? (tpmChangeRequest.trim() || undefined) : undefined,
      phaseId: nextPhaseId
    };
    upsertCycle(next);
  };

  return (
    <section className="rounded-xl border bg-white p-7 shadow-sm space-y-8">
      <div className="space-y-4 text-base">
        <div className="space-y-2">
          <div className="text-sm font-medium text-slate-700">TPM outcome</div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input
                type="radio"
                name="tpmOutcome"
                className="h-4 w-4"
                disabled={preview}
                checked={tpmOutcome === "approved"}
                onChange={() => setTpmOutcome("approved")}
              />
              TPM approves
            </label>

            {tpmOutcome === "approved" ? (
              <div className="ml-6 space-y-3">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-700">Upload TPM confirmation email</label>
                  <input type="file" className="text-sm" disabled={preview} />
                </div>
                <div className="space-y-1 max-w-xs">
                  <label className="block text-sm font-medium text-slate-700">Date TPM confirmed</label>
                  <input
                    type="date"
                    className="w-full rounded-md border px-3 py-2 text-base"
                    disabled={preview}
                    value={tpmConfirmedDate}
                    onChange={(e) => setTpmConfirmedDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-700">Upload finalized forecast file</label>
                  <input type="file" className="text-sm" disabled={preview} />
                </div>
              </div>
            ) : null}

            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input
                type="radio"
                name="tpmOutcome"
                className="h-4 w-4"
                disabled={preview}
                checked={tpmOutcome === "changes_requested"}
                onChange={() => setTpmOutcome("changes_requested")}
              />
              TPM requests changes (revert to Phase 2)
            </label>

            {tpmOutcome === "changes_requested" ? (
              <div className="ml-6 space-y-1">
                <label className="block text-sm font-medium text-slate-700">Requested changes (for assignee)</label>
                <textarea
                  className="w-full rounded-md border px-3 py-2.5 text-base"
                  rows={3}
                  placeholder="Summarise what TPM wants changed and why."
                  disabled={preview}
                  value={tpmChangeRequest}
                  onChange={(e) => setTpmChangeRequest(e.target.value)}
                />
                <div className="text-xs text-slate-500">
                  This will be shown to assignee(s) when the instance reverts to Phase 2.
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex justify-end gap-2 text-sm">
          <button
            type="button"
            className="rounded-md border px-4 py-2 text-slate-700 hover:bg-slate-50"
            disabled={preview || !cycleId}
            onClick={() => {
              persist(4);
              router.push("/");
            }}
          >
            Save draft
          </button>
          <button
            type="button"
            className={
              preview
                ? "rounded-md bg-slate-900 px-4 py-2 text-white opacity-60"
                : "rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
            }
            disabled={
              preview ||
              (tpmOutcome === "changes_requested" && tpmChangeRequest.trim().length === 0)
            }
            onClick={() => {
              if (preview) return;
              if (tpmOutcome === "approved") {
                if (!cycleId) return;
                upsertCycle({
                  ...(cycle ?? baseCycleForPhase(cycleId, 4)),
                  id: cycleId,
                  tpmConfirmedDate: tpmConfirmedDate || undefined,
                  tpmOutcome,
                  tpmChangeRequest: undefined,
                  phaseId: 4,
                  forecastPdfHref: cycle?.forecastPdfHref ?? "/sample-forecast.pdf",
                  closed: true
                });
                router.push("/");
                return;
              }

              // Changes requested: revert to Phase 2 (internal id 1)
              persist(1);
              if (cycleId) router.push(`/phases/1?cycle=${encodeURIComponent(cycleId)}`);
              else router.push("/phases/1");
            }}
          >
            {tpmOutcome === "approved" ? "Close forecast instance" : "Request changes (revert to Phase 2)"}
          </button>
        </div>
      </div>
    </section>
  );
}
