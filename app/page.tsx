import Image from 'next/image';
import { SetupsTableClient } from './SetupsTableClient';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 py-6">
      <div className="mx-auto max-w-7xl px-4 space-y-8">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Image
              src="/AbbVie_logo.svg%20(1).png"
              alt="AbbVie"
              width={140}
              height={40}
              priority
            />
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">Forecast Management System</h1>
              <p className="mt-1 text-base text-slate-600">
                End-to-end view of the AbbVie forecast management process, from preparation to storing.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start md:items-end gap-2 text-xs text-slate-500">
            <span className="uppercase tracking-wide">Mock-up only</span>
          
          </div>
        </header>

        <section>
          <SetupsTableClient />
        </section>
      </div>
    </main>
  );
}