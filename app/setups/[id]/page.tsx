import Link from "next/link";
import { SetupDetailClient } from "../setup-detail-client";

export default function SetupDetailPage({ params }: { params: { id: string } }) {
  return (
    <main className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto max-w-screen-2xl px-4 space-y-8">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            ← Home
          </Link>
        </header>

        <SetupDetailClient setupId={params.id} />
      </div>
    </main>
  );
}
