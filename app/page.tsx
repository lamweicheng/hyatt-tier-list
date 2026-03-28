import { HyattTierListClient } from './HyattTierListClient';
import { listDashboardPreferences } from '@/lib/dashboard-preferences';
import { listHotels, isDatabaseConfigured } from '@/lib/hotels';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const initialHotels = await listHotels();
  const initialDashboardPreferences = await listDashboardPreferences();

  return (
    <HyattTierListClient
      initialHotels={initialHotels}
      initialDashboardPreferences={initialDashboardPreferences}
      persistenceMode={isDatabaseConfigured() ? 'database' : 'local'}
    />
  );
}