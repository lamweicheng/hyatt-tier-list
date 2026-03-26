import Image from "next/image";
import { AnalyticsClient } from "./AnalyticsClient";

export default function AnalyticsPage() {
  return (
    <main className="min-h-screen bg-slate-50 py-6">
      <div className="mx-auto max-w-7xl px-4 space-y-8">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Image src="/AbbVie_logo.svg%20(1).png" alt="AbbVie" width={140} height={40} priority />
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">Analytics &amp; Reporting</h1>
              <p className="mt-1 text-base text-slate-600">
                Summary reporting across Setups and forecast instances (mock-up only).
              </p>
            </div>
          </div>
        </header>

        <section>
          <AnalyticsClient />
        </section>
      </div>
    </main>
  );
}
