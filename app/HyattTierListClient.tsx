'use client';

import { FormEvent, startTransition, useEffect, useMemo, useState } from 'react';
import { BRAND_BY_NAME, BRANDS_BY_SEGMENT, HYATT_BRANDS, TIERS, sortHotelsByTier } from '@/lib/hyatt-data';
import { FancySelect } from '@/components/ui/fancy-select';
import type {
  HotelDraft,
  HotelRecord,
  PersistenceMode,
  RoomEntry,
  RoomEntryKind,
  StayType,
  Tier
} from '@/lib/types';

const LOCAL_STORAGE_KEY = 'hyatt-tier-list.hotels';

const DEFAULT_DRAFT: HotelDraft = {
  name: '',
  brand: HYATT_BRANDS[0].name,
  stayType: 'EXPLORED',
  tier: 'S',
  roomEntries: []
};

const EMPTY_ROOM_ENTRY: RoomEntry = {
  label: '',
  kind: 'ROOM'
};

const SUMMARY_TABS: Array<{ id: StayType; label: string }> = [
  { id: 'EXPLORED', label: 'Explored' },
  { id: 'FUTURE', label: 'Future' }
];

const ROOM_KIND_OPTIONS: Array<{ value: RoomEntryKind; label: string }> = [
  { value: 'ROOM', label: 'Room' },
  { value: 'SUITE', label: 'Suite' }
];

const STAY_TYPE_OPTIONS: Array<{ value: StayType; label: string }> = [
  { value: 'EXPLORED', label: 'Explored' },
  { value: 'FUTURE', label: 'Future' }
];

const TIER_STYLES: Record<
  Tier,
  {
    panel: string;
    badge: string;
    empty: string;
  }
> = {
  S: {
    panel: 'from-[#7a1f2c]/14 via-[#f6e6d3] to-white',
    badge: 'bg-[#7a1f2c] text-white',
    empty: 'Nothing in S-tier yet.'
  },
  A: {
    panel: 'from-[#b47036]/14 via-[#f7ecdd] to-white',
    badge: 'bg-[#b47036] text-white',
    empty: 'No A-tier entries yet.'
  },
  B: {
    panel: 'from-[#4c7a68]/14 via-[#eff4ef] to-white',
    badge: 'bg-[#4c7a68] text-white',
    empty: 'No B-tier entries yet.'
  },
  C: {
    panel: 'from-[#5a6d8f]/14 via-[#eef2f7] to-white',
    badge: 'bg-[#5a6d8f] text-white',
    empty: 'No C-tier entries yet.'
  },
  D: {
    panel: 'from-[#6a5358]/14 via-[#f3eef0] to-white',
    badge: 'bg-[#6a5358] text-white',
    empty: 'No D-tier entries yet.'
  }
};

type ModalState =
  | {
      mode: 'create';
    }
  | {
      mode: 'edit';
      hotelId: string;
    }
  | null;

type DropTargetState = {
  stayType: StayType;
  tier: Tier | null;
  beforeHotelId: string | null;
} | null;

type DropTarget = {
  stayType: StayType;
  tier: Tier | null;
  beforeHotelId: string | null;
};

function isTier(value: unknown): value is Tier {
  return TIERS.includes(value as Tier);
}

function normalizeRoomEntries(value: unknown): RoomEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map<RoomEntry>((entry) => ({
      label: typeof entry.label === 'string' ? entry.label : '',
      kind: entry.kind === 'SUITE' ? 'SUITE' : 'ROOM'
    }))
    .filter((entry) => entry.label.trim().length > 0);
}

function normalizeHotelRecord(value: unknown): HotelRecord {
  const raw = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const stayType: StayType = raw.stayType === 'FUTURE' ? 'FUTURE' : 'EXPLORED';
  const tier = stayType === 'EXPLORED' && isTier(raw.tier) ? raw.tier : null;
  const timestamp = new Date().toISOString();

  return {
    id: typeof raw.id === 'string' ? raw.id : crypto.randomUUID(),
    name: typeof raw.name === 'string' ? raw.name : '',
    brand:
      typeof raw.brand === 'string' && BRAND_BY_NAME[raw.brand]
        ? raw.brand
        : HYATT_BRANDS[0].name,
    stayType,
    tier,
    roomEntries: stayType === 'EXPLORED' ? normalizeRoomEntries(raw.roomEntries) : [],
    position: typeof raw.position === 'number' && Number.isInteger(raw.position) ? raw.position : 0,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : timestamp,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : timestamp
  };
}

function normalizeHotelCollection(hotels: HotelRecord[]) {
  const normalizedHotels = hotels.map(normalizeHotelRecord);
  const explored = TIERS.flatMap((tier) =>
    sortHotelsByTier(
      normalizedHotels.filter((hotel) => hotel.stayType === 'EXPLORED' && hotel.tier === tier)
    ).map((hotel, index) => ({
      ...hotel,
      tier,
      position: index
    }))
  );

  const future = sortHotelsByTier(
    normalizedHotels.filter((hotel) => hotel.stayType === 'FUTURE')
  ).map((hotel, index) => ({
    ...hotel,
    tier: null,
    position: index,
    roomEntries: []
  }));

  return sortHotelsByTier([...explored, ...future]);
}

function createLocalHotel(payload: HotelDraft): HotelRecord {
  const timestamp = new Date().toISOString();

  return normalizeHotelRecord({
    id: crypto.randomUUID(),
    ...payload,
    createdAt: timestamp,
    updatedAt: timestamp,
    position: 0
  });
}

function moveHotelInCollection(
  hotels: HotelRecord[],
  hotelId: string,
  stayType: StayType,
  tier: Tier | null,
  beforeHotelId: string | null
) {
  const draggedHotel = hotels.find((hotel) => hotel.id === hotelId);

  if (!draggedHotel) {
    return hotels;
  }

  if (stayType === 'EXPLORED' && !tier) {
    return hotels;
  }

  if (stayType === 'FUTURE' && draggedHotel.stayType !== 'FUTURE') {
    return hotels;
  }

  const normalizedTier = stayType === 'FUTURE' ? null : tier;

  if (
    beforeHotelId === hotelId &&
    draggedHotel.stayType === stayType &&
    draggedHotel.tier === normalizedTier
  ) {
    return hotels;
  }

  const remainingHotels = hotels.filter((hotel) => hotel.id !== hotelId);
  const targetGroupHotels = remainingHotels.filter(
    (hotel) => hotel.stayType === stayType && hotel.tier === normalizedTier
  );
  const otherHotels = remainingHotels.filter(
    (hotel) => !(hotel.stayType === stayType && hotel.tier === normalizedTier)
  );

  const updatedDraggedHotel = normalizeHotelRecord({
    ...draggedHotel,
    stayType,
    tier: normalizedTier,
    roomEntries: stayType === 'EXPLORED' ? draggedHotel.roomEntries : []
  });

  const nextTargetGroup = [...targetGroupHotels];
  const insertIndex = beforeHotelId
    ? nextTargetGroup.findIndex((hotel) => hotel.id === beforeHotelId)
    : -1;

  if (insertIndex >= 0) {
    nextTargetGroup.splice(insertIndex, 0, updatedDraggedHotel);
  } else {
    nextTargetGroup.push(updatedDraggedHotel);
  }

  return normalizeHotelCollection([...otherHotels, ...nextTargetGroup]);
}

function resolveDropTargetFromPointer(
  event: React.DragEvent<HTMLElement>,
  stayType: StayType,
  tier: Tier | null
): DropTarget {
  const elementUnderPointer = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
  const hotelCard = elementUnderPointer?.closest<HTMLElement>('[data-hotel-id]');

  return {
    stayType,
    tier,
    beforeHotelId: hotelCard?.dataset.hotelId || null
  };
}

function countUniqueBrands(hotels: HotelRecord[]) {
  return new Set(hotels.map((hotel) => hotel.brand)).size;
}

function countSuites(hotels: HotelRecord[]) {
  return hotels.reduce(
    (total, hotel) => total + hotel.roomEntries.filter((entry) => entry.kind === 'SUITE').length,
    0
  );
}

export function HyattTierListClient({
  initialHotels,
  persistenceMode
}: {
  initialHotels: HotelRecord[];
  persistenceMode: PersistenceMode;
}) {
  const [hotels, setHotels] = useState(() => normalizeHotelCollection(initialHotels));
  const [modalState, setModalState] = useState<ModalState>(null);
  const [draft, setDraft] = useState<HotelDraft>(DEFAULT_DRAFT);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedHotelId, setDraggedHotelId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTargetState>(null);
  const [recentlyDraggedHotelId, setRecentlyDraggedHotelId] = useState<string | null>(null);
  const [isBrandPaletteOpen, setIsBrandPaletteOpen] = useState(false);
  const [summaryTab, setSummaryTab] = useState<StayType>('EXPLORED');

  useEffect(() => {
    setIsHydrated(true);

    if (persistenceMode !== 'local') {
      return;
    }

    const storedHotels = window.localStorage.getItem(LOCAL_STORAGE_KEY);

    if (!storedHotels) {
      return;
    }

    try {
      const parsedHotels = JSON.parse(storedHotels) as unknown[];
      setHotels(normalizeHotelCollection(parsedHotels.map(normalizeHotelRecord)));
    } catch {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, [persistenceMode]);

  useEffect(() => {
    if (!isHydrated || persistenceMode !== 'local') {
      return;
    }

    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(hotels));
  }, [hotels, isHydrated, persistenceMode]);

  const exploredHotels = useMemo(
    () => sortHotelsByTier(hotels.filter((hotel) => hotel.stayType === 'EXPLORED')),
    [hotels]
  );
  const futureHotels = useMemo(
    () => sortHotelsByTier(hotels.filter((hotel) => hotel.stayType === 'FUTURE')),
    [hotels]
  );

  const hotelsByTier = useMemo(() => {
    return TIERS.reduce(
      (collection, tier) => {
        collection[tier] = exploredHotels.filter((hotel) => hotel.tier === tier);
        return collection;
      },
      {} as Record<Tier, HotelRecord[]>
    );
  }, [exploredHotels]);

  const exploredBrandCount = useMemo(() => countUniqueBrands(exploredHotels), [exploredHotels]);
  const futureBrandCount = useMemo(() => countUniqueBrands(futureHotels), [futureHotels]);
  const exploredSuiteCount = useMemo(() => countSuites(exploredHotels), [exploredHotels]);
  const mappedBrands = useMemo(
    () => HYATT_BRANDS.filter((brand) => exploredHotels.some((hotel) => hotel.brand === brand.name)),
    [exploredHotels]
  );
  const draggedHotel = useMemo(
    () => hotels.find((hotel) => hotel.id === draggedHotelId) ?? null,
    [draggedHotelId, hotels]
  );

  const summaryCards =
    summaryTab === 'EXPLORED'
      ? [
          { label: 'Hotel Explored', value: exploredHotels.length },
          { label: 'Brand Explored', value: `${exploredBrandCount}/${HYATT_BRANDS.length}` },
          { label: 'Suite Explored', value: exploredSuiteCount }
        ]
      : [
          { label: 'Future Hotel Stays (2026 & 2027)', value: futureHotels.length },
          { label: 'Future Hotel Brands (2026 & 2027)', value: `${futureBrandCount}/${HYATT_BRANDS.length}` }
        ];

  function closeModal() {
    setModalState(null);
    setDraft(DEFAULT_DRAFT);
    setErrorMessage(null);
  }

  function openCreateModal() {
    setDraft(DEFAULT_DRAFT);
    setErrorMessage(null);
    setModalState({ mode: 'create' });
  }

  function openEditModal(hotel: HotelRecord) {
    setDraft({
      name: hotel.name,
      brand: hotel.brand,
      stayType: hotel.stayType,
      tier: hotel.tier,
      roomEntries: hotel.roomEntries.length ? hotel.roomEntries : []
    });
    setErrorMessage(null);
    setModalState({ mode: 'edit', hotelId: hotel.id });
  }

  function resetDragState() {
    setDraggedHotelId(null);
    setDropTarget(null);
  }

  async function persistDelete(hotelId: string) {
    if (persistenceMode === 'local') {
      setHotels((currentHotels) => normalizeHotelCollection(currentHotels.filter((hotel) => hotel.id !== hotelId)));
      return;
    }

    const response = await fetch(`/api/hotels/${hotelId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const result = (await response.json()) as { message?: string };
      throw new Error(result.message || 'Unable to delete hotel.');
    }
  }

  async function persistCreate(payload: HotelDraft) {
    if (persistenceMode === 'local') {
      return createLocalHotel(payload);
    }

    const response = await fetch('/api/hotels', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = (await response.json()) as { hotel?: HotelRecord; message?: string };

    if (!response.ok || !result.hotel) {
      throw new Error(result.message || 'Unable to save hotel.');
    }

    return normalizeHotelRecord(result.hotel);
  }

  async function persistUpdate(hotelId: string, payload: HotelDraft) {
    if (persistenceMode === 'local') {
      const existingHotel = hotels.find((hotel) => hotel.id === hotelId);

      if (!existingHotel) {
        throw new Error('Hotel could not be found.');
      }

      return normalizeHotelRecord({
        ...existingHotel,
        ...payload,
        updatedAt: new Date().toISOString()
      });
    }

    const response = await fetch(`/api/hotels/${hotelId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = (await response.json()) as { hotel?: HotelRecord; message?: string };

    if (!response.ok || !result.hotel) {
      throw new Error(result.message || 'Unable to update hotel.');
    }

    return normalizeHotelRecord(result.hotel);
  }

  async function persistHotelOrder(nextHotels: HotelRecord[]) {
    const orderedHotels = normalizeHotelCollection(nextHotels);

    if (persistenceMode === 'local') {
      setHotels(orderedHotels);
      resetDragState();
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/hotels/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          hotels: orderedHotels.map((hotel) => ({
            id: hotel.id,
            stayType: hotel.stayType,
            tier: hotel.tier,
            position: hotel.position
          }))
        })
      });

      const result = (await response.json()) as { hotels?: HotelRecord[]; message?: string };

      if (!response.ok || !result.hotels) {
        throw new Error(result.message || 'Unable to reorder hotels.');
      }

      setHotels(normalizeHotelCollection(result.hotels.map(normalizeHotelRecord)));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to reorder hotels.');
    } finally {
      setIsSaving(false);
      resetDragState();
    }
  }

  async function handleDropOnTarget(stayType: StayType, tier: Tier | null, beforeHotelId: string | null) {
    if (!draggedHotelId) {
      return;
    }

    const nextHotels = moveHotelInCollection(hotels, draggedHotelId, stayType, tier, beforeHotelId);
    await persistHotelOrder(nextHotels);
  }

  async function handleDelete() {
    if (modalState?.mode !== 'edit') {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await persistDelete(modalState.hotelId);

      if (persistenceMode !== 'local') {
        startTransition(() => {
          setHotels((currentHotels) => normalizeHotelCollection(currentHotels.filter((hotel) => hotel.id !== modalState.hotelId)));
        });
      }

      closeModal();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to delete hotel.');
    } finally {
      setIsSaving(false);
    }
  }

  function buildPayloadFromDraft(): HotelDraft {
    const cleanedRoomEntries = draft.roomEntries
      .map((entry) => ({
        label: entry.label.trim(),
        kind: entry.kind
      }))
      .filter((entry) => entry.label.length > 0);

    return {
      name: draft.name.trim(),
      brand: draft.brand,
      stayType: draft.stayType,
      tier: draft.stayType === 'EXPLORED' ? draft.tier ?? 'S' : null,
      roomEntries: draft.stayType === 'EXPLORED' ? cleanedRoomEntries : []
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = buildPayloadFromDraft();

    if (!payload.name) {
      setErrorMessage('Hotel name is required.');
      return;
    }

    if (payload.stayType === 'EXPLORED' && !payload.tier) {
      setErrorMessage('Select a tier.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      if (modalState?.mode === 'edit') {
        const updatedHotel = await persistUpdate(modalState.hotelId, payload);
        startTransition(() => {
          setHotels((currentHotels) =>
            normalizeHotelCollection(
              currentHotels.map((hotel) => (hotel.id === updatedHotel.id ? updatedHotel : hotel))
            )
          );
        });
      } else {
        const createdHotel = await persistCreate(payload);
        startTransition(() => {
          setHotels((currentHotels) => normalizeHotelCollection([...currentHotels, createdHotel]));
        });
      }

      closeModal();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save hotel.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleHotelClick(hotel: HotelRecord) {
    if (recentlyDraggedHotelId === hotel.id) {
      setRecentlyDraggedHotelId(null);
      return;
    }

    openEditModal(hotel);
  }

  function updateRoomEntry(index: number, updater: (entry: RoomEntry) => RoomEntry) {
    setDraft((current) => ({
      ...current,
      roomEntries: current.roomEntries.map((entry, entryIndex) =>
        entryIndex === index ? updater(entry) : entry
      )
    }));
  }

  function addRoomEntry() {
    setDraft((current) => ({
      ...current,
      roomEntries: [...current.roomEntries, { ...EMPTY_ROOM_ENTRY }]
    }));
  }

  function removeRoomEntry(index: number) {
    setDraft((current) => ({
      ...current,
      roomEntries: current.roomEntries.filter((_, entryIndex) => entryIndex !== index)
    }));
  }

  return (
    <main className="relative overflow-hidden px-3 py-4 sm:px-5 lg:px-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(circle_at_top_left,rgba(179,141,78,0.2),transparent_34%),radial-gradient(circle_at_top_right,rgba(0,102,179,0.18),transparent_32%)]" />

      <div className="relative mx-auto flex max-w-[1500px] flex-col gap-4 pb-8">
        <section className="glass-panel relative overflow-hidden rounded-[30px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="section-label">World of Hyatt</p>
                <h1 className="mt-3 max-w-3xl font-[family:var(--font-display)] text-3xl leading-none text-[rgb(var(--page-foreground))] sm:text-4xl lg:text-5xl">
                  My Hyatt Tier List
                </h1>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
                <button
                  type="button"
                  onClick={() => setIsBrandPaletteOpen(true)}
                  className="inline-flex items-center justify-center rounded-full border border-[rgba(0,102,179,0.18)] bg-white/82 px-5 py-3 text-sm font-semibold text-[rgb(var(--wine))] shadow-[0_12px_24px_rgba(26,74,122,0.08)] transition hover:-translate-y-0.5 hover:bg-[rgba(0,102,179,0.06)]"
                  aria-label="Open brand palette"
                >
                  Brands
                </button>
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex items-center justify-center rounded-full bg-[rgb(var(--wine))] px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(26,74,122,0.22)] transition hover:-translate-y-0.5 hover:bg-[#004f8d]"
                >
                  Add hotel
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Stay summary tabs">
                {SUMMARY_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={summaryTab === tab.id}
                    onClick={() => setSummaryTab(tab.id)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${summaryTab === tab.id ? 'bg-[rgb(var(--wine))] text-white shadow-[0_12px_28px_rgba(26,74,122,0.16)]' : 'border border-[rgba(0,102,179,0.16)] bg-white/82 text-[rgb(var(--page-foreground))] hover:bg-[rgba(0,102,179,0.06)]'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className={`grid gap-3 ${summaryTab === 'EXPLORED' ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2'}`}>
                {summaryCards.map((card) => (
                  <div key={card.label} className="soft-ring rounded-[24px] bg-white/82 p-4">
                    <div className="text-[0.72rem] uppercase tracking-[0.16em] text-[rgba(34,58,86,0.52)]">
                      {card.label}
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-[rgb(var(--page-foreground))] sm:text-[1.75rem]">
                      {card.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="glass-panel rounded-[28px] px-4 py-4 sm:px-5 sm:py-5">
          <p className="section-label">Tier Board</p>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
            <div className="flex flex-col gap-3">
              {TIERS.map((tier) => {
                const tierHotels = hotelsByTier[tier];
                const tierStyle = TIER_STYLES[tier];

                return (
                  <section
                    key={tier}
                    onDragOver={(event) => {
                      if (!draggedHotelId) {
                        return;
                      }

                      event.preventDefault();
                      setDropTarget(resolveDropTargetFromPointer(event, 'EXPLORED', tier));
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const target = resolveDropTargetFromPointer(event, 'EXPLORED', tier);
                      void handleDropOnTarget(target.stayType, target.tier, target.beforeHotelId);
                    }}
                    className={`tier-shell rounded-[24px] bg-gradient-to-r ${tierStyle.panel} p-3.5 sm:p-4`}
                    style={{
                      outline:
                        dropTarget?.stayType === 'EXPLORED' && dropTarget.tier === tier
                          ? '2px solid rgba(0,102,179,0.18)'
                          : 'none',
                      outlineOffset: '3px'
                    }}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-bold ${tierStyle.badge}`}>
                          {tier}
                        </div>
                        <div className="text-lg font-semibold text-[rgb(var(--page-foreground))]">
                          {tier}-Tier
                        </div>
                      </div>

                      <div className="rounded-full border border-white/80 bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(34,58,86,0.58)]">
                        {tierHotels.length} hotel{tierHotels.length === 1 ? '' : 's'}
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                      {tierHotels.length === 0 ? (
                        <div className="rounded-[18px] border border-dashed border-[rgba(0,102,179,0.16)] bg-white/55 p-4 text-sm text-[rgba(34,58,86,0.58)]">
                          {tierStyle.empty}
                        </div>
                      ) : (
                        tierHotels.map((hotel) => {
                          const brandColor = BRAND_BY_NAME[hotel.brand]?.color || '#7A1F2C';

                          return (
                            <div
                              key={hotel.id}
                              data-hotel-id={hotel.id}
                              draggable
                              onDragStart={(event) => {
                                setDraggedHotelId(hotel.id);
                                setDropTarget({ stayType: 'EXPLORED', tier: hotel.tier, beforeHotelId: hotel.id });
                                setRecentlyDraggedHotelId(hotel.id);
                                event.dataTransfer.effectAllowed = 'move';
                                event.dataTransfer.setData('text/plain', hotel.id);
                              }}
                              onDragEnd={() => {
                                window.setTimeout(() => {
                                  setRecentlyDraggedHotelId(null);
                                }, 0);
                                resetDragState();
                              }}
                              onClick={() => handleHotelClick(hotel)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  handleHotelClick(hotel);
                                }
                              }}
                              aria-grabbed={draggedHotelId === hotel.id}
                              role="button"
                              tabIndex={0}
                              className="group rounded-[18px] border bg-white/82 p-3 text-left transition hover:-translate-y-0.5 hover:shadow-[0_14px_26px_rgba(26,74,122,0.11)]"
                              style={{
                                borderColor:
                                  dropTarget?.stayType === 'EXPLORED' &&
                                  dropTarget.tier === tier &&
                                  dropTarget.beforeHotelId === hotel.id
                                    ? `${brandColor}66`
                                    : `${brandColor}28`,
                                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.8), 0 14px 30px ${brandColor}10`,
                                opacity: draggedHotelId === hotel.id ? 0.55 : 1,
                                cursor: draggedHotelId === hotel.id ? 'grabbing' : 'grab'
                              }}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="line-clamp-2 text-base font-semibold leading-5 text-[rgb(var(--page-foreground))] transition group-hover:text-[rgb(var(--wine))]">
                                    {hotel.name}
                                  </div>
                                  {hotel.roomEntries.length ? (
                                    <div className="mt-2 text-xs text-[rgba(34,58,86,0.58)]">
                                      {hotel.roomEntries.length} room type{hotel.roomEntries.length === 1 ? '' : 's'} logged
                                    </div>
                                  ) : null}
                                </div>

                                <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: brandColor }} />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </section>
                );
              })}
            </div>

            <aside className="tier-shell rounded-[24px] bg-white/74 p-4">
              <div className="section-label">Brands Explored</div>
              <div className="mt-3 flex flex-wrap gap-2.5 xl:flex-col xl:gap-2">
                {mappedBrands.length ? (
                  mappedBrands.map((brand) => (
                    <div
                      key={brand.name}
                      className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] shadow-[0_10px_22px_rgba(26,74,122,0.06)]"
                      style={{
                        borderColor: `${brand.color}33`,
                        backgroundColor: `${brand.color}14`,
                        color: brand.color
                      }}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: brand.color }} />
                      {brand.name}
                    </div>
                  ))
                ) : (
                  <div className="rounded-[18px] border border-dashed border-[rgba(0,102,179,0.16)] bg-white/55 p-4 text-sm text-[rgba(34,58,86,0.58)]">
                    No explored brands yet.
                  </div>
                )}
              </div>
            </aside>
          </div>
        </section>

        <section className="glass-panel rounded-[28px] px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="section-label">Future Stays</p>
              <div className="mt-2 text-xl font-semibold text-[rgb(var(--page-foreground))] font-[family:var(--font-display)]">
                Future Stays
              </div>
            </div>
            <div className="rounded-full border border-white/80 bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(34,58,86,0.58)]">
              {futureHotels.length} future hotel{futureHotels.length === 1 ? '' : 's'}
            </div>
          </div>

          <div
            className="mt-4 rounded-[24px] border border-dashed border-[rgba(0,102,179,0.14)] bg-white/40 p-3 sm:p-4"
            onDragOver={(event) => {
              if (!draggedHotel || draggedHotel.stayType !== 'FUTURE') {
                return;
              }

              event.preventDefault();
              setDropTarget(resolveDropTargetFromPointer(event, 'FUTURE', null));
            }}
            onDrop={(event) => {
              if (!draggedHotel || draggedHotel.stayType !== 'FUTURE') {
                return;
              }

              event.preventDefault();
              const target = resolveDropTargetFromPointer(event, 'FUTURE', null);
              void handleDropOnTarget(target.stayType, target.tier, target.beforeHotelId);
            }}
            style={{
              outline: dropTarget?.stayType === 'FUTURE' ? '2px solid rgba(0,102,179,0.18)' : 'none',
              outlineOffset: '3px'
            }}
          >
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {futureHotels.length ? (
                futureHotels.map((hotel) => {
                  const brandColor = BRAND_BY_NAME[hotel.brand]?.color || '#7A1F2C';

                  return (
                    <div
                      key={hotel.id}
                      data-hotel-id={hotel.id}
                      draggable
                      onDragStart={(event) => {
                        setDraggedHotelId(hotel.id);
                        setDropTarget({ stayType: 'FUTURE', tier: null, beforeHotelId: hotel.id });
                        setRecentlyDraggedHotelId(hotel.id);
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', hotel.id);
                      }}
                      onDragEnd={() => {
                        window.setTimeout(() => {
                          setRecentlyDraggedHotelId(null);
                        }, 0);
                        resetDragState();
                      }}
                      onClick={() => handleHotelClick(hotel)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleHotelClick(hotel);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      className="group rounded-[18px] border bg-white/84 p-3 text-left transition hover:-translate-y-0.5 hover:shadow-[0_14px_26px_rgba(26,74,122,0.11)]"
                      style={{
                        borderColor: dropTarget?.stayType === 'FUTURE' && dropTarget.beforeHotelId === hotel.id ? `${brandColor}66` : `${brandColor}28`,
                        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.8), 0 14px 30px ${brandColor}10`,
                        opacity: draggedHotelId === hotel.id ? 0.55 : 1,
                        cursor: draggedHotelId === hotel.id ? 'grabbing' : 'grab'
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="line-clamp-2 text-base font-semibold leading-5 text-[rgb(var(--page-foreground))] transition group-hover:text-[rgb(var(--wine))]">
                            {hotel.name}
                          </div>
                          <div className="mt-2 text-xs text-[rgba(34,58,86,0.58)]">
                            Drag into a tier when explored.
                          </div>
                        </div>
                        <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: brandColor }} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-[18px] border border-dashed border-[rgba(0,102,179,0.16)] bg-white/55 p-4 text-sm text-[rgba(34,58,86,0.58)]">
                  No future stays yet.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {isBrandPaletteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(42,18,22,0.48)] px-4 py-8 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-4xl rounded-[30px] p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label">Brand Palette</p>
                <h2 className="mt-2 text-3xl font-semibold leading-none text-[rgb(var(--page-foreground))] font-[family:var(--font-display)] sm:text-4xl">
                  Hyatt brands and colors
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setIsBrandPaletteOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(118,31,47,0.16)] bg-white/80 text-lg text-[rgb(var(--wine))] transition hover:bg-[rgba(118,31,47,0.06)]"
                aria-label="Close brand palette"
              >
                ×
              </button>
            </div>

            <div className="mt-6 max-h-[70vh] overflow-auto pr-1">
              <div className="space-y-5">
                {BRANDS_BY_SEGMENT.map(({ segment, brands }) => (
                  <div key={segment} className="rounded-[24px] border border-[rgba(118,31,47,0.1)] bg-white/60 p-4">
                    <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgba(64,35,37,0.48)]">
                      {segment}
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      {brands.map((brand) => (
                        <div
                          key={brand.name}
                          className="rounded-full border px-3 py-2 text-xs font-semibold shadow-[0_10px_22px_rgba(81,39,43,0.08)]"
                          style={{
                            borderColor: `${brand.color}33`,
                            backgroundColor: `${brand.color}14`,
                            color: brand.color
                          }}
                        >
                          {brand.name}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {modalState ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(42,18,22,0.48)] px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-8">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={modalState.mode === 'edit' ? 'Edit hotel stay' : 'Add hotel stay'}
            className="glass-panel w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[30px] p-5 sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label">{modalState.mode === 'edit' ? 'Edit Hotel' : 'Add Hotel'}</p>
                <h2 className="mt-2 text-3xl font-semibold leading-none text-[rgb(var(--page-foreground))] font-[family:var(--font-display)] sm:text-4xl">
                  {modalState.mode === 'edit' ? 'Update this stay' : 'Add a Hyatt stay'}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(118,31,47,0.16)] bg-white/80 text-lg text-[rgb(var(--wine))] transition hover:bg-[rgba(118,31,47,0.06)]"
                aria-label="Close hotel editor"
              >
                ×
              </button>
            </div>

            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-2 md:col-span-2">
                  <span className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Hotel name</span>
                  <input
                    value={draft.name}
                    onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                    className="w-full rounded-[18px] border border-[rgba(118,31,47,0.14)] bg-white/88 px-4 py-3 text-sm text-[rgb(var(--page-foreground))] outline-none transition focus:border-[rgba(118,31,47,0.32)] focus:ring-4 focus:ring-[rgba(118,31,47,0.08)]"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Brand</span>
                  <FancySelect
                    value={draft.brand}
                    onChange={(value) => setDraft((current) => ({ ...current, brand: value }))}
                    groups={BRANDS_BY_SEGMENT.map(({ segment, brands }) => ({
                      label: segment,
                      options: brands.map((brand) => ({
                        value: brand.name,
                        label: brand.name,
                        color: brand.color
                      }))
                    }))}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Stay type</span>
                  <FancySelect
                    value={draft.stayType}
                    onChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        stayType: value as StayType,
                        tier: value === 'EXPLORED' ? current.tier ?? 'S' : null,
                        roomEntries: value === 'EXPLORED' ? current.roomEntries : []
                      }))
                    }
                    options={STAY_TYPE_OPTIONS}
                  />
                </label>

                {draft.stayType === 'EXPLORED' ? (
                  <>
                    <label className="block space-y-2 md:col-span-2 lg:col-span-1">
                      <span className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Tier</span>
                      <FancySelect
                        value={draft.tier ?? 'S'}
                        onChange={(value) => setDraft((current) => ({ ...current, tier: value as Tier }))}
                        options={TIERS.map((tier) => ({
                          value: tier,
                          label: `${tier}-Tier`
                        }))}
                      />
                    </label>

                    <div className="space-y-3 md:col-span-2">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Room Type</div>
                          <div className="mt-1 text-xs text-[rgba(34,58,86,0.58)]">
                            Add each room or suite you stayed in for this hotel.
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={addRoomEntry}
                          className="inline-flex items-center justify-center rounded-full border border-[rgba(0,102,179,0.16)] bg-white/82 px-4 py-2 text-sm font-semibold text-[rgb(var(--wine))] transition hover:bg-[rgba(0,102,179,0.06)]"
                        >
                          Add room type
                        </button>
                      </div>

                      {draft.roomEntries.length ? (
                        <div className="space-y-3">
                          {draft.roomEntries.map((entry, index) => (
                            <div
                              key={`${index}-${entry.kind}`}
                              className="grid gap-3 rounded-[20px] border border-[rgba(0,102,179,0.1)] bg-white/72 p-3 md:grid-cols-[minmax(0,1fr)_10rem_auto]"
                            >
                              <input
                                value={entry.label}
                                onChange={(event) =>
                                  updateRoomEntry(index, (current) => ({
                                    ...current,
                                    label: event.target.value
                                  }))
                                }
                                placeholder="Standard"
                                className="w-full rounded-[16px] border border-[rgba(118,31,47,0.14)] bg-white/92 px-4 py-3 text-sm text-[rgb(var(--page-foreground))] outline-none transition focus:border-[rgba(118,31,47,0.32)] focus:ring-4 focus:ring-[rgba(118,31,47,0.08)]"
                              />

                              <FancySelect
                                value={entry.kind}
                                onChange={(value) =>
                                  updateRoomEntry(index, (current) => ({
                                    ...current,
                                    kind: value as RoomEntryKind
                                  }))
                                }
                                options={ROOM_KIND_OPTIONS}
                              />

                              <button
                                type="button"
                                onClick={() => removeRoomEntry(index)}
                                className="inline-flex items-center justify-center rounded-full border border-[rgba(163,33,48,0.18)] bg-[rgba(163,33,48,0.08)] px-4 py-2 text-sm font-semibold text-[#a32130] transition hover:bg-[rgba(163,33,48,0.12)]"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-[18px] border border-dashed border-[rgba(0,102,179,0.16)] bg-white/55 p-4 text-sm text-[rgba(34,58,86,0.58)]">
                          No room types added yet.
                        </div>
                      )}
                    </div>
                  </>
                ) : null}
              </div>

              {errorMessage ? (
                <div className="rounded-[18px] border border-[rgba(118,31,47,0.18)] bg-[rgba(118,31,47,0.06)] px-4 py-3 text-sm text-[rgb(var(--wine))]">
                  {errorMessage}
                </div>
              ) : null}

              <div className="flex flex-col gap-3 border-t border-[rgba(118,31,47,0.1)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  {modalState.mode === 'edit' ? (
                    <button
                      type="button"
                      onClick={() => void handleDelete()}
                      disabled={isSaving}
                      className="rounded-full border border-[rgba(163,33,48,0.18)] bg-[rgba(163,33,48,0.08)] px-5 py-2.5 text-sm font-semibold text-[#a32130] transition hover:bg-[rgba(163,33,48,0.12)] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      Delete hotel
                    </button>
                  ) : null}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-full border border-[rgba(118,31,47,0.16)] bg-white/82 px-5 py-2.5 text-sm font-semibold text-[rgb(var(--page-foreground))] transition hover:bg-[rgba(118,31,47,0.06)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="rounded-full bg-[rgb(var(--wine))] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#004f8d] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSaving
                      ? 'Saving...'
                      : modalState.mode === 'edit'
                        ? 'Save changes'
                        : 'Add hotel'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}