import { HyattTierListClient } from './HyattTierListClient';
import { listHotels, isDatabaseConfigured } from '@/lib/hotels';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const initialHotels = await listHotels();

  return (
    <HyattTierListClient
      initialHotels={initialHotels}
      persistenceMode={isDatabaseConfigured() ? 'database' : 'local'}
    />
  );
}