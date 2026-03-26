"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { SetupRow } from "../lib/setups";
import type { ForecastCycleRow } from "../lib/cycles";

type SessionDataContextValue = {
  setupsById: Record<string, SetupRow>;
  cyclesById: Record<string, ForecastCycleRow>;
  upsertSetup: (setup: SetupRow) => void;
  upsertCycle: (cycle: ForecastCycleRow) => void;
  removeSetup: (id: string) => void;
  removeCycle: (id: string) => void;
};

const SessionDataContext = createContext<SessionDataContextValue | null>(null);

export function SessionDataProvider({ children }: { children: React.ReactNode }) {
  const [setupsById, setSetupsById] = useState<Record<string, SetupRow>>({});
  const [cyclesById, setCyclesById] = useState<Record<string, ForecastCycleRow>>({});

  const value = useMemo<SessionDataContextValue>(() => {
    return {
      setupsById,
      cyclesById,
      upsertSetup: (setup) => {
        setSetupsById((prev) => ({ ...prev, [setup.id]: setup }));
      },
      upsertCycle: (cycle) => {
        setCyclesById((prev) => ({ ...prev, [cycle.id]: cycle }));
      },
      removeSetup: (id) => {
        setSetupsById((prev) => {
          if (!prev[id]) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
      },
      removeCycle: (id) => {
        setCyclesById((prev) => {
          if (!prev[id]) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    };
  }, [setupsById, cyclesById]);

  return <SessionDataContext.Provider value={value}>{children}</SessionDataContext.Provider>;
}

export function useSessionData() {
  const ctx = useContext(SessionDataContext);
  if (!ctx) throw new Error("useSessionData must be used within SessionDataProvider");
  return ctx;
}

export function useSessionSetups() {
  const { setupsById, upsertSetup, removeSetup } = useSessionData();
  return { setupsById, upsertSetup, removeSetup };
}

export function useSessionCycles() {
  const { cyclesById, upsertCycle, removeCycle } = useSessionData();
  return { cyclesById, upsertCycle, removeCycle };
}
