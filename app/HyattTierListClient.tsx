'use client';

import { FormEvent, startTransition, useEffect, useMemo, useState } from 'react';
import { BRAND_BY_NAME, BRANDS_BY_SEGMENT, HYATT_BRANDS, TIERS, sortHotelsByTier } from '@/lib/hyatt-data';
import { FancySelect } from '@/components/ui/fancy-select';
import type { HotelDraft, HotelRecord, PersistenceMode, Tier } from '@/lib/types';

const LOCAL_STORAGE_KEY = 'hyatt-tier-list.hotels';

const DEFAULT_DRAFT: HotelDraft = {
  name: '',
  brand: HYATT_BRANDS[0].name,
  tier: 'S'
};

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
  tier: Tier;
  beforeHotelId: string | null;
} | null;

type DropTarget = {
  tier: Tier;
  beforeHotelId: string | null;
};

function createLocalHotel(payload: HotelDraft): HotelRecord {
  const timestamp = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    ...payload,
    position: 0,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function moveHotelInCollection(
  hotels: HotelRecord[],
  hotelId: string,
  tier: Tier,
  beforeHotelId: string | null
) {
  const draggedHotel = hotels.find((hotel) => hotel.id === hotelId);

  if (!draggedHotel) {
    return hotels;
  }

   if (beforeHotelId === hotelId && draggedHotel.tier === tier) {
    return hotels;
  }

  const remainingHotels = hotels.filter((hotel) => hotel.id !== hotelId);
  const updatedDraggedHotel: HotelRecord = {
    ...draggedHotel,
    tier
  };

  const groupedHotels = TIERS.reduce(
    (collection, currentTier) => {
      collection[currentTier] = remainingHotels.filter((hotel) => hotel.tier === currentTier);
      return collection;
    },
    {} as Record<Tier, HotelRecord[]>
  );

  const nextTierHotels = [...groupedHotels[tier]];

  if (beforeHotelId) {
    const insertIndex = nextTierHotels.findIndex((hotel) => hotel.id === beforeHotelId);
    if (insertIndex >= 0) {
      nextTierHotels.splice(insertIndex, 0, updatedDraggedHotel);
    } else {
      nextTierHotels.push(updatedDraggedHotel);
    }
  } else {
    nextTierHotels.push(updatedDraggedHotel);
  }

  groupedHotels[tier] = nextTierHotels.map((hotel, index) => ({
    ...hotel,
    position: index
  }));

  return TIERS.flatMap((currentTier) =>
    (currentTier === tier ? groupedHotels[currentTier] : groupedHotels[currentTier].map((hotel, index) => ({
      ...hotel,
      position: index
    })))
  );
}

function resolveDropTargetFromPointer(event: React.DragEvent<HTMLElement>, tier: Tier): DropTarget {
  const elementUnderPointer = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
  const hotelCard = elementUnderPointer?.closest<HTMLElement>('[data-hotel-id]');

  return {
    tier,
    beforeHotelId: hotelCard?.dataset.hotelId || null
  };
}

export function HyattTierListClient({
  initialHotels,
  persistenceMode
}: {
  initialHotels: HotelRecord[];
  persistenceMode: PersistenceMode;
}) {
  const [hotels, setHotels] = useState(() => sortHotelsByTier(initialHotels));
  const [modalState, setModalState] = useState<ModalState>(null);
  const [draft, setDraft] = useState<HotelDraft>(DEFAULT_DRAFT);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedHotelId, setDraggedHotelId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTargetState>(null);
  const [recentlyDraggedHotelId, setRecentlyDraggedHotelId] = useState<string | null>(null);
  const [isBrandPaletteOpen, setIsBrandPaletteOpen] = useState(false);

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
      const parsedHotels = JSON.parse(storedHotels) as HotelRecord[];
      setHotels(sortHotelsByTier(parsedHotels));
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

  const hotelsByTier = useMemo(() => {
    return TIERS.reduce(
      (collection, tier) => {
        collection[tier] = sortHotelsByTier(hotels.filter((hotel) => hotel.tier === tier));
        return collection;
      },
      {} as Record<Tier, HotelRecord[]>
    );
  }, [hotels]);

  const rankedBrands = useMemo(() => new Set(hotels.map((hotel) => hotel.brand)).size, [hotels]);
  const mappedBrands = useMemo(
    () => HYATT_BRANDS.filter((brand) => hotels.some((hotel) => hotel.brand === brand.name)),
    [hotels]
  );

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
      tier: hotel.tier
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
      setHotels((currentHotels) =>
        sortHotelsByTier(
          currentHotels
            .filter((hotel) => hotel.id !== hotelId)
            .map((hotel, index, collection) => ({
              ...hotel,
              position: collection.filter((candidate) => candidate.tier === hotel.tier).findIndex((candidate) => candidate.id === hotel.id)
            }))
        )
      );
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

    return result.hotel;
  }

  async function persistUpdate(hotelId: string, payload: HotelDraft) {
    if (persistenceMode === 'local') {
      const existingHotel = hotels.find((hotel) => hotel.id === hotelId);

      if (!existingHotel) {
        throw new Error('Hotel could not be found.');
      }

      return {
        ...existingHotel,
        ...payload,
        updatedAt: new Date().toISOString()
      };
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

    return result.hotel;
  }

  async function persistHotelOrder(nextHotels: HotelRecord[]) {
    const orderedHotels = sortHotelsByTier(nextHotels);

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
            tier: hotel.tier,
            position: hotel.position
          }))
        })
      });

      const result = (await response.json()) as { hotels?: HotelRecord[]; message?: string };

      if (!response.ok || !result.hotels) {
        throw new Error(result.message || 'Unable to reorder hotels.');
      }

      setHotels(sortHotelsByTier(result.hotels));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to reorder hotels.');
    } finally {
      setIsSaving(false);
      resetDragState();
    }
  }

  async function handleDropOnTarget(tier: Tier, beforeHotelId: string | null) {
    if (!draggedHotelId) {
      return;
    }

    const nextHotels = moveHotelInCollection(hotels, draggedHotelId, tier, beforeHotelId);
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
          setHotels((currentHotels) => currentHotels.filter((hotel) => hotel.id !== modalState.hotelId));
        });
      }

      closeModal();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to delete hotel.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const hotelName = draft.name.trim();

    if (!hotelName) {
      setErrorMessage('Hotel name is required.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const payload: HotelDraft = {
      ...draft,
      name: hotelName
    };

    try {
      if (modalState?.mode === 'edit') {
        const updatedHotel = await persistUpdate(modalState.hotelId, payload);
        startTransition(() => {
          setHotels((currentHotels) =>
            sortHotelsByTier(
              currentHotels.map((hotel) => (hotel.id === updatedHotel.id ? updatedHotel : hotel))
            )
          );
        });
      } else {
        const createdHotel = await persistCreate(payload);
        startTransition(() => {
          setHotels((currentHotels) => sortHotelsByTier([...currentHotels, createdHotel]));
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

  return (
    <main className="relative overflow-hidden px-3 py-4 sm:px-5 lg:px-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(circle_at_top_left,rgba(179,141,78,0.2),transparent_34%),radial-gradient(circle_at_top_right,rgba(0,102,179,0.18),transparent_32%)]" />

      <div className="relative mx-auto flex max-w-[1500px] flex-col gap-4 pb-6">
        <section className="glass-panel relative overflow-hidden rounded-[30px] px-5 py-5 sm:px-7 sm:py-6 lg:px-8">
          <div className="relative">
            <div className="flex flex-col gap-6">
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

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="soft-ring rounded-[24px] bg-white/82 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-[rgba(34,58,86,0.52)]">
                    Hotel Explored
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-[rgb(var(--page-foreground))] sm:text-[1.75rem]">
                    {hotels.length}
                  </div>
                </div>
                <div className="soft-ring rounded-[24px] bg-white/82 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-[rgba(34,58,86,0.52)]">
                    Brands Explored
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-[rgb(var(--page-foreground))] sm:text-[1.75rem]">
                    {rankedBrands}/{HYATT_BRANDS.length}
                  </div>
                </div>
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
                      setDropTarget(resolveDropTargetFromPointer(event, tier));
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const target = resolveDropTargetFromPointer(event, tier);
                      void handleDropOnTarget(target.tier, target.beforeHotelId);
                    }}
                    className={`tier-shell rounded-[24px] bg-gradient-to-r ${tierStyle.panel} p-3.5 sm:p-4`}
                    style={{
                      outline: dropTarget?.tier === tier ? '2px solid rgba(0,102,179,0.18)' : 'none',
                      outlineOffset: '3px'
                    }}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-bold ${tierStyle.badge}`}>
                          {tier}
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-[rgb(var(--page-foreground))]">
                            {tier}-Tier
                          </div>
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
                          const brand = BRAND_BY_NAME[hotel.brand];
                          const brandColor = brand?.color || '#7A1F2C';

                          return (
                            <div
                              key={hotel.id}
                              data-hotel-id={hotel.id}
                              draggable
                              onDragStart={(event) => {
                                setDraggedHotelId(hotel.id);
                                setDropTarget({ tier: hotel.tier, beforeHotelId: hotel.id });
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
                                  dropTarget?.tier === tier && dropTarget.beforeHotelId === hotel.id
                                    ? `${brandColor}66`
                                    : `${brandColor}28`,
                                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.8), 0 14px 30px ${brandColor}10`,
                                opacity: draggedHotelId === hotel.id ? 0.55 : 1,
                                cursor: draggedHotelId === hotel.id ? 'grabbing' : 'grab'
                              }}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="line-clamp-2 text-base font-semibold leading-5 text-[rgb(var(--page-foreground))] transition group-hover:text-[rgb(var(--wine))]">
                                  {hotel.name}
                                </div>

                                <span
                                  className="mt-1 h-3 w-3 shrink-0 rounded-full"
                                  style={{ backgroundColor: brandColor }}
                                />
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
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: brand.color }}
                      />
                      {brand.name}
                    </div>
                  ))
                ) : (
                  <div className="rounded-[18px] border border-dashed border-[rgba(0,102,179,0.16)] bg-white/55 p-4 text-sm text-[rgba(34,58,86,0.58)]">
                    No mapped brands yet.
                  </div>
                )}
              </div>
            </aside>
          </div>
        </section>
      </div>

      {isBrandPaletteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(42,18,22,0.48)] px-4 py-8 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-4xl rounded-[30px] p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label">Brand Palette</p>
                <h2 className="mt-2 text-4xl font-semibold leading-none text-[rgb(var(--page-foreground))] font-[family:var(--font-display)]">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(42,18,22,0.48)] px-4 py-8 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-xl rounded-[30px] p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label">{modalState.mode === 'edit' ? 'Edit Hotel' : 'Add Hotel'}</p>
                <h2 className="mt-2 text-4xl font-semibold leading-none text-[rgb(var(--page-foreground))] font-[family:var(--font-display)]">
                  {modalState.mode === 'edit' ? 'Update this ranking' : 'Add a Hyatt hotel'}
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

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Hotel name</span>
                <input
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  placeholder=""
                  className="w-full rounded-[18px] border border-[rgba(118,31,47,0.14)] bg-white/88 px-4 py-3 text-sm text-[rgb(var(--page-foreground))] outline-none transition placeholder:text-[rgba(64,35,37,0.42)] focus:border-[rgba(118,31,47,0.32)] focus:ring-4 focus:ring-[rgba(118,31,47,0.08)]"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
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
                  <span className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Tier</span>
                  <FancySelect
                    value={draft.tier}
                    onChange={(value) => setDraft((current) => ({ ...current, tier: value as Tier }))}
                    options={TIERS.map((tier) => ({
                      value: tier,
                      label: `${tier}-Tier`
                    }))}
                  />
                </label>
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
                    className="rounded-full bg-[rgb(var(--wine))] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#641826] disabled:cursor-not-allowed disabled:opacity-70"
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