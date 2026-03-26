import { Suspense } from "react";
import Link from "next/link";
import { SetupNewClient } from "./setup-new-client";

export default function NewSetupPage() {
  return (
    <main className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto max-w-3xl px-4 space-y-8">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            ← Home
          </Link>
        </header>

        <Suspense fallback={null}>
          <SetupNewClient />
        </Suspense>
      </div>
    </main>
  );
}
