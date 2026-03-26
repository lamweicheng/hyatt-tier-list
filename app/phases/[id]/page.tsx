import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PHASES } from '../../../lib/phases';
import { PhaseScreen } from '../PhaseScreen';
import BackButton from '../../components/BackButton';

export default function PhasePage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: { cycle?: string };
}) {
  const id = Number(params.id);
  const phase = PHASES.find((p) => p.id === id);
  const cycleId = searchParams?.cycle;

  if (!phase) {
    notFound();
  }

  const currentIndex = PHASES.findIndex((p) => p.id === phase.id);
  void currentIndex;

  return (
    <main className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto max-w-5xl px-4 space-y-8">
        <header>
          <div>
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                ← Home
              </Link>
              <BackButton />
            </div>
          </div>
        </header>

        <PhaseScreen phaseId={phase.id} cycleId={cycleId} phaseName={phase.name} instruction={phase.shortDescription} />

      </div>
    </main>
  );
}
