import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto max-w-3xl px-4">
        <div className="rounded-xl border bg-white p-6 space-y-3">
          <div className="text-2xl font-semibold text-slate-900">Page not found</div>
          <div className="text-sm text-slate-600">The page you’re looking for doesn’t exist in this prototype.</div>
          <div>
            <Link
              href="/"
              className="inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              ← Home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
