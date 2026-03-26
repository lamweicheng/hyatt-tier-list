"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { RecordRow } from "../lib/records";

type SessionRecordsContextValue = {
  upsertsById: Record<string, RecordRow>;
  upsertRecord: (record: RecordRow) => void;
  removeRecord: (id: string) => void;
};

const SessionRecordsContext = createContext<SessionRecordsContextValue | null>(null);

export function SessionRecordsProvider({ children }: { children: React.ReactNode }) {
  const [upsertsById, setUpsertsById] = useState<Record<string, RecordRow>>({});

  const value = useMemo<SessionRecordsContextValue>(() => {
    return {
      upsertsById,
      upsertRecord: (record) => {
        setUpsertsById((prev) => ({ ...prev, [record.id]: record }));
      },
      removeRecord: (id) => {
        setUpsertsById((prev) => {
          if (!prev[id]) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    };
  }, [upsertsById]);

  return <SessionRecordsContext.Provider value={value}>{children}</SessionRecordsContext.Provider>;
}

export function useSessionRecords() {
  const ctx = useContext(SessionRecordsContext);
  if (!ctx) throw new Error("useSessionRecords must be used within SessionRecordsProvider");
  return ctx;
}
