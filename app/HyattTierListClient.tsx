'use client';

import { FormEvent, startTransition, useEffect, useMemo, useRef, useState } from 'react';
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
const TOP_PICKS_STORAGE_KEY = 'hyatt-tier-list.top-picks';
const TOP_SUITES_STORAGE_KEY = 'hyatt-tier-list.top-suites';
const DISPLAY_PREFERENCES_STORAGE_KEY = 'hyatt-tier-list.display-preferences';

const DEFAULT_DRAFT: HotelDraft = {
  name: '',
  brand: HYATT_BRANDS[0].name,
  stayType: 'EXPLORED',
  tier: 'S',
  roomEntries: []
};

const EMPTY_ROOM_ENTRY: RoomEntry = {
  label: '',
  kind: 'SUITE'
};

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

type BrandVisualStyle = {
  borderColor: string;
  background: string;
  labelColor: string;
  dotColor: string;
  shadowColor: string;
};

type TopPickRank = 1 | 2 | 3;

type TopPickSlot = {
  rank: TopPickRank;
  hotelId: string;
  imageUrl: string;
};

type TopSuiteSlot = {
  rank: TopPickRank;
  hotelId: string;
  suiteName: string;
  imageUrl: string;
};

type DisplayPreferences = {
  showTopHotels: boolean;
  showTopSuites: boolean;
  showTierBoard: boolean;
  showFutureHotels: boolean;
};

const DEFAULT_TOP_PICKS: TopPickSlot[] = [
  { rank: 1, hotelId: '', imageUrl: '' },
  { rank: 2, hotelId: '', imageUrl: '' },
  { rank: 3, hotelId: '', imageUrl: '' }
];

const DEFAULT_TOP_SUITES: TopSuiteSlot[] = [
  { rank: 1, hotelId: '', suiteName: '', imageUrl: '' },
  { rank: 2, hotelId: '', suiteName: '', imageUrl: '' },
  { rank: 3, hotelId: '', suiteName: '', imageUrl: '' }
];

const DEFAULT_DISPLAY_PREFERENCES: DisplayPreferences = {
  showTopHotels: true,
  showTopSuites: true,
  showTierBoard: true,
  showFutureHotels: true
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
    roomEntries: normalizeRoomEntries(raw.roomEntries),
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
    roomEntries: hotel.roomEntries
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
    roomEntries: draggedHotel.roomEntries
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
  const scope = event.currentTarget as HTMLElement;
  const hotelCards = Array.from(scope.querySelectorAll<HTMLElement>('[data-hotel-id]'));

  const sortedCards = hotelCards.sort((left, right) => {
    const leftRect = left.getBoundingClientRect();
    const rightRect = right.getBoundingClientRect();

    if (Math.abs(leftRect.top - rightRect.top) > 8) {
      return leftRect.top - rightRect.top;
    }

    return leftRect.left - rightRect.left;
  });

  const hotelCard =
    sortedCards.find((card) => {
      const rect = card.getBoundingClientRect();
      const pointerAboveMidpoint = event.clientY < rect.top + rect.height / 2;
      const sameRow = Math.abs(event.clientY - (rect.top + rect.height / 2)) <= rect.height / 1.5;
      const pointerLeftOfMidpoint = event.clientX < rect.left + rect.width / 2;

      return pointerAboveMidpoint || (sameRow && pointerLeftOfMidpoint);
    }) ?? null;

  return {
    stayType,
    tier,
    beforeHotelId: hotelCard?.dataset.hotelId || null
  };
}

function countUniqueBrands(hotels: HotelRecord[]) {
  return new Set(hotels.map((hotel) => hotel.brand)).size;
}

function countAdditionalFutureBrands(exploredHotels: HotelRecord[], futureHotels: HotelRecord[]) {
  const exploredBrands = new Set(exploredHotels.map((hotel) => hotel.brand));

  return new Set(
    futureHotels
      .map((hotel) => hotel.brand)
      .filter((brand) => !exploredBrands.has(brand))
  ).size;
}

function countSuites(hotels: HotelRecord[]) {
  return hotels.reduce(
    (total, hotel) => total + hotel.roomEntries.filter((entry) => entry.kind === 'SUITE').length,
    0
  );
}

function formatRoomEntries(entries: RoomEntry[]) {
  return entries.map((entry) => entry.label).join(', ');
}

function normalizeTopPickSlots(value: unknown): TopPickSlot[] {
  if (!Array.isArray(value)) {
    return DEFAULT_TOP_PICKS;
  }

  const byRank = new Map<TopPickRank, TopPickSlot>();

  value.forEach((entry) => {
    if (typeof entry !== 'object' || entry === null) {
      return;
    }

    const record = entry as Record<string, unknown>;
    const rank = record.rank;

    if (rank !== 1 && rank !== 2 && rank !== 3) {
      return;
    }

    byRank.set(rank, {
      rank,
      hotelId: typeof record.hotelId === 'string' ? record.hotelId : '',
      imageUrl: typeof record.imageUrl === 'string' ? record.imageUrl : ''
    });
  });

  return DEFAULT_TOP_PICKS.map((slot) => byRank.get(slot.rank) ?? slot);
}

function normalizeTopSuiteSlots(value: unknown): TopSuiteSlot[] {
  if (!Array.isArray(value)) {
    return DEFAULT_TOP_SUITES;
  }

  const byRank = new Map<TopPickRank, TopSuiteSlot>();

  value.forEach((entry) => {
    if (typeof entry !== 'object' || entry === null) {
      return;
    }

    const record = entry as Record<string, unknown>;
    const rank = record.rank;

    if (rank !== 1 && rank !== 2 && rank !== 3) {
      return;
    }

    byRank.set(rank, {
      rank,
      hotelId: typeof record.hotelId === 'string' ? record.hotelId : '',
      suiteName: typeof record.suiteName === 'string' ? record.suiteName : '',
      imageUrl: typeof record.imageUrl === 'string' ? record.imageUrl : ''
    });
  });

  return DEFAULT_TOP_SUITES.map((slot) => byRank.get(slot.rank) ?? slot);
}

function normalizeDisplayPreferences(value: unknown): DisplayPreferences {
  if (typeof value !== 'object' || value === null) {
    return DEFAULT_DISPLAY_PREFERENCES;
  }

  const record = value as Record<string, unknown>;

  return {
    showTopHotels:
      typeof record.showTopHotels === 'boolean'
        ? record.showTopHotels
        : DEFAULT_DISPLAY_PREFERENCES.showTopHotels,
    showTopSuites:
      typeof record.showTopSuites === 'boolean'
        ? record.showTopSuites
        : DEFAULT_DISPLAY_PREFERENCES.showTopSuites,
    showTierBoard:
      typeof record.showTierBoard === 'boolean'
        ? record.showTierBoard
        : DEFAULT_DISPLAY_PREFERENCES.showTierBoard,
    showFutureHotels:
      typeof record.showFutureHotels === 'boolean'
        ? record.showFutureHotels
        : DEFAULT_DISPLAY_PREFERENCES.showFutureHotels
  };
}

function hexToRgb(hex: string) {
  const sanitized = hex.replace('#', '');
  const normalized = sanitized.length === 3
    ? sanitized
        .split('')
        .map((char) => `${char}${char}`)
        .join('')
    : sanitized;

  const value = Number.parseInt(normalized, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function rgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function shiftColor(hex: string, amount: number) {
  const { r, g, b } = hexToRgb(hex);
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

  const shifted = {
    r: clamp(r + amount),
    g: clamp(g + amount / 2),
    b: clamp(b - amount / 3)
  };

  return `#${[shifted.r, shifted.g, shifted.b]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`;
}

function getBrandVisualStyle(brandName: string, brandColor: string): BrandVisualStyle {
  const hash = [...brandName].reduce((total, char) => total + char.charCodeAt(0), 0);
  const offset = (hash % 5) * 16 - 24;
  const accent = shiftColor(brandColor, offset);
  const paleAccent = shiftColor(brandColor, offset > 0 ? 42 : 28);

  return {
    borderColor: rgba(brandColor, 0.55),
    background: `linear-gradient(135deg, ${rgba(accent, 0.14)} 0%, ${rgba(paleAccent, 0.1)} 34%, rgba(255,255,255,0.96) 100%)`,
    labelColor: shiftColor(brandColor, -22),
    dotColor: accent,
    shadowColor: rgba(accent, 0.14)
  };
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
  const [isCompactMode, setIsCompactMode] = useState(false);
  const [isAllBrandsOpen, setIsAllBrandsOpen] = useState(false);
  const [isExploredBrandsOpen, setIsExploredBrandsOpen] = useState(false);
  const [isFutureBrandsOpen, setIsFutureBrandsOpen] = useState(false);
  const [isSuitesOpen, setIsSuitesOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isTopPicksOpen, setIsTopPicksOpen] = useState(false);
  const [isTopSuitesOpen, setIsTopSuitesOpen] = useState(false);
  const [selectedBrandName, setSelectedBrandName] = useState<string | null>(null);
  const reorderRequestIdRef = useRef(0);
  const [topPicks, setTopPicks] = useState<TopPickSlot[]>(DEFAULT_TOP_PICKS);
  const [topPicksDraft, setTopPicksDraft] = useState<TopPickSlot[]>(DEFAULT_TOP_PICKS);
  const [topPicksError, setTopPicksError] = useState<string | null>(null);
  const [topSuites, setTopSuites] = useState<TopSuiteSlot[]>(DEFAULT_TOP_SUITES);
  const [topSuitesDraft, setTopSuitesDraft] = useState<TopSuiteSlot[]>(DEFAULT_TOP_SUITES);
  const [topSuitesError, setTopSuitesError] = useState<string | null>(null);
  const [displayPreferences, setDisplayPreferences] = useState<DisplayPreferences>(DEFAULT_DISPLAY_PREFERENCES);

  useEffect(() => {
    setIsHydrated(true);

    if (persistenceMode === 'local') {
      const storedHotels = window.localStorage.getItem(LOCAL_STORAGE_KEY);

      if (storedHotels) {
        try {
          const parsedHotels = JSON.parse(storedHotels) as unknown[];
          setHotels(normalizeHotelCollection(parsedHotels.map(normalizeHotelRecord)));
        } catch {
          window.localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
      }
    }

    const storedTopPicks = window.localStorage.getItem(TOP_PICKS_STORAGE_KEY);

    if (storedTopPicks) {
      try {
        const parsedTopPicks = JSON.parse(storedTopPicks) as unknown;
        const normalizedTopPicks = normalizeTopPickSlots(parsedTopPicks);
        setTopPicks(normalizedTopPicks);
        setTopPicksDraft(normalizedTopPicks);
      } catch {
        window.localStorage.removeItem(TOP_PICKS_STORAGE_KEY);
      }
    }

    const storedTopSuites = window.localStorage.getItem(TOP_SUITES_STORAGE_KEY);

    if (storedTopSuites) {
      try {
        const parsedTopSuites = JSON.parse(storedTopSuites) as unknown;
        const normalizedTopSuites = normalizeTopSuiteSlots(parsedTopSuites);
        setTopSuites(normalizedTopSuites);
        setTopSuitesDraft(normalizedTopSuites);
      } catch {
        window.localStorage.removeItem(TOP_SUITES_STORAGE_KEY);
      }
    }

    const storedDisplayPreferences = window.localStorage.getItem(DISPLAY_PREFERENCES_STORAGE_KEY);

    if (storedDisplayPreferences) {
      try {
        setDisplayPreferences(normalizeDisplayPreferences(JSON.parse(storedDisplayPreferences) as unknown));
      } catch {
        window.localStorage.removeItem(DISPLAY_PREFERENCES_STORAGE_KEY);
      }
    }
  }, [persistenceMode]);

  useEffect(() => {
    if (!isHydrated || persistenceMode !== 'local') {
      return;
    }

    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(hotels));
  }, [hotels, isHydrated, persistenceMode]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.localStorage.setItem(TOP_PICKS_STORAGE_KEY, JSON.stringify(topPicks));
  }, [isHydrated, topPicks]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.localStorage.setItem(TOP_SUITES_STORAGE_KEY, JSON.stringify(topSuites));
  }, [isHydrated, topSuites]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.localStorage.setItem(DISPLAY_PREFERENCES_STORAGE_KEY, JSON.stringify(displayPreferences));
  }, [displayPreferences, isHydrated]);

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
  const exploredSuiteCount = useMemo(() => countSuites(exploredHotels), [exploredHotels]);
  const brandsExploringCount = useMemo(
    () => countAdditionalFutureBrands(exploredHotels, futureHotels),
    [exploredHotels, futureHotels]
  );
  const mappedBrands = useMemo(
    () => HYATT_BRANDS.filter((brand) => exploredHotels.some((hotel) => hotel.brand === brand.name)),
    [exploredHotels]
  );
  const selectedBrand = useMemo(
    () => (selectedBrandName ? BRAND_BY_NAME[selectedBrandName] ?? null : null),
    [selectedBrandName]
  );
  const exploredBrandNames = useMemo(() => new Set(exploredHotels.map((hotel) => hotel.brand)), [exploredHotels]);
  const futureExploringBrands = useMemo(
    () => HYATT_BRANDS.filter((brand) => futureHotels.some((hotel) => hotel.brand === brand.name) && !exploredBrandNames.has(brand.name)),
    [exploredBrandNames, futureHotels]
  );
  const exploredSuites = useMemo(
    () =>
      exploredHotels.flatMap((hotel) =>
        hotel.roomEntries
          .filter((entry) => entry.kind === 'SUITE')
          .map((entry) => ({ hotelName: hotel.name, brand: hotel.brand, suiteName: entry.label, tier: hotel.tier }))
      ),
    [exploredHotels]
  );
  const exploredHotelsWithSuites = useMemo(
    () => exploredHotels.filter((hotel) => hotel.roomEntries.some((entry) => entry.kind === 'SUITE')),
    [exploredHotels]
  );
  const selectedBrandHotels = useMemo(
    () => (selectedBrandName ? sortHotelsByTier(hotels.filter((hotel) => hotel.brand === selectedBrandName)) : []),
    [hotels, selectedBrandName]
  );
  const topPicksResolved = useMemo(
    () =>
      topPicks
        .map((slot) => ({
          ...slot,
          hotel: exploredHotels.find((hotel) => hotel.id === slot.hotelId) ?? null
        }))
        .filter((slot) => slot.hotel)
        .sort((left, right) => left.rank - right.rank),
    [exploredHotels, topPicks]
  );
  const hasCompleteTopPicks = topPicksResolved.length === 3 && topPicks.every((slot) => slot.hotelId);
  const topSuitesResolved = useMemo(
    () =>
      topSuites
        .map((slot) => ({
          ...slot,
          suiteName: slot.suiteName.trim(),
          hotel: exploredHotelsWithSuites.find((hotel) => hotel.id === slot.hotelId) ?? null
        }))
        .filter((slot) => slot.hotel && slot.suiteName)
        .sort((left, right) => left.rank - right.rank),
    [exploredHotelsWithSuites, topSuites]
  );
  const hasCompleteTopSuites =
    topSuitesResolved.length === 3 && topSuites.every((slot) => slot.hotelId && slot.suiteName.trim());
  const draggedHotel = useMemo(
    () => hotels.find((hotel) => hotel.id === draggedHotelId) ?? null,
    [draggedHotelId, hotels]
  );

  const summaryCards = [
    { label: 'Hotels Explored', value: exploredHotels.length },
    { label: 'Brands Explored', value: `${exploredBrandCount}/${HYATT_BRANDS.length}` },
    { label: 'Suites Explored', value: exploredSuiteCount },
    { label: 'Planned Hotel Explorations', value: futureHotels.length },
    {
      label: 'Planned Brand Explorations',
      value: brandsExploringCount
    }
  ];

  useEffect(() => {
    setTopPicks((current) =>
      current.map((slot) =>
        exploredHotels.some((hotel) => hotel.id === slot.hotelId)
          ? slot
          : { ...slot, hotelId: '', imageUrl: '' }
      )
    );
  }, [exploredHotels]);

  useEffect(() => {
    setTopSuites((current) =>
      current.map((slot) => {
        const hotel = exploredHotelsWithSuites.find((item) => item.id === slot.hotelId);

        if (!hotel) {
          return { ...slot, hotelId: '', suiteName: '', imageUrl: '' };
        }

        return slot;
      })
    );
  }, [exploredHotelsWithSuites]);

  function closeModal() {
    setModalState(null);
    setDraft(DEFAULT_DRAFT);
    setErrorMessage(null);
  }

  function openTopPicksModal() {
    setTopPicksDraft(topPicks);
    setTopPicksError(null);
    setIsTopPicksOpen(true);
  }

  function handleSaveTopPicks() {
    const selectedHotelIds = topPicksDraft.map((slot) => slot.hotelId).filter(Boolean);

    if (selectedHotelIds.length !== new Set(selectedHotelIds).size) {
      setTopPicksError('Each top pick must be a different hotel.');
      return;
    }

    setTopPicks(
      topPicksDraft.map((slot) => ({
        ...slot,
        imageUrl: slot.imageUrl.trim()
      }))
    );
    setTopPicksError(null);
    setIsTopPicksOpen(false);
  }

  function openTopSuitesModal() {
    setTopSuitesDraft(topSuites);
    setTopSuitesError(null);
    setIsTopSuitesOpen(true);
  }

  function handleSaveTopSuites() {
    const selectedSuites = topSuitesDraft
      .map((slot) => `${slot.hotelId}::${slot.suiteName.trim().toLowerCase()}`)
      .filter((value) => value !== '::');

    if (selectedSuites.length !== new Set(selectedSuites).size) {
      setTopSuitesError('Each top suite must be a different hotel and suite combination.');
      return;
    }

    setTopSuites(
      topSuitesDraft.map((slot) => ({
        ...slot,
        suiteName: slot.suiteName.trim(),
        imageUrl: slot.imageUrl.trim()
      }))
    );
    setTopSuitesError(null);
    setIsTopSuitesOpen(false);
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

    const previousHotels = hotels;
    const requestId = reorderRequestIdRef.current + 1;
    reorderRequestIdRef.current = requestId;

    setHotels(orderedHotels);
    resetDragState();
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

      const result = (await response.json()) as { ok?: boolean; message?: string };

      if (!response.ok || !result.ok) {
        throw new Error(result.message || 'Unable to reorder hotels.');
      }
    } catch (error) {
      if (requestId === reorderRequestIdRef.current) {
        setHotels(previousHotels);
      }
      setErrorMessage(error instanceof Error ? error.message : 'Unable to reorder hotels.');
    } finally {
      setIsSaving(false);
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
      roomEntries: cleanedRoomEntries
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
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(true)}
                  className="section-label transition hover:text-[rgb(var(--wine))]"
                >
                  World of Hyatt
                </button>
                <h1 className="mt-3 max-w-3xl font-[family:var(--font-display)] text-3xl leading-none text-[rgb(var(--page-foreground))] sm:text-4xl lg:text-5xl">
                  My Hyatt Tier List
                </h1>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
                <button
                  type="button"
                  onClick={() => setIsAllBrandsOpen(true)}
                  className="inline-flex items-center justify-center rounded-full border border-[rgba(0,102,179,0.18)] bg-white/82 px-5 py-3 text-sm font-semibold text-[rgb(var(--wine))] shadow-[0_12px_24px_rgba(26,74,122,0.08)] transition hover:-translate-y-0.5 hover:bg-[rgba(0,102,179,0.06)]"
                  aria-label="Open all Hyatt brands"
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

            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-5">
                {summaryCards.map((card) => (
                  <div key={card.label} className="soft-ring rounded-[20px] bg-white/82 p-3 sm:rounded-[24px] sm:p-4">
                    <div className="text-[0.62rem] uppercase tracking-[0.14em] text-[rgba(34,58,86,0.52)] sm:text-[0.72rem] sm:tracking-[0.16em]">
                      {card.label === 'Brands Explored' ? (
                        <button
                          type="button"
                          onClick={() => setIsExploredBrandsOpen(true)}
                          className="text-[0.62rem] uppercase tracking-[0.14em] text-[rgba(34,58,86,0.52)] transition hover:text-[rgb(var(--wine))] sm:text-[0.72rem] sm:tracking-[0.16em]"
                        >
                          {card.label}
                        </button>
                      ) : card.label === 'Suites Explored' ? (
                        <button
                          type="button"
                          onClick={() => setIsSuitesOpen(true)}
                          className="text-[0.62rem] uppercase tracking-[0.14em] text-[rgba(34,58,86,0.52)] transition hover:text-[rgb(var(--wine))] sm:text-[0.72rem] sm:tracking-[0.16em]"
                        >
                          {card.label}
                        </button>
                      ) : card.label === 'Planned Brand Explorations' ? (
                        <button
                          type="button"
                          onClick={() => setIsFutureBrandsOpen(true)}
                          className="text-[0.62rem] uppercase tracking-[0.14em] text-[rgba(34,58,86,0.52)] transition hover:text-[rgb(var(--wine))] sm:text-[0.72rem] sm:tracking-[0.16em]"
                        >
                          {card.label}
                        </button>
                      ) : (
                        card.label
                      )}
                    </div>
                    <div className="mt-1.5 text-lg font-semibold text-[rgb(var(--page-foreground))] sm:mt-2 sm:text-[1.75rem]">
                      {card.value}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </section>

        {displayPreferences.showTopHotels ? (
        <section className="glass-panel rounded-[28px] px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <button
                type="button"
                onClick={openTopPicksModal}
                className="section-label transition hover:text-[rgb(var(--wine))]"
              >
                Top 3 Hotels
              </button>
              <h2 className="mt-2 text-2xl font-semibold text-[rgb(var(--page-foreground))] font-[family:var(--font-display)] sm:text-3xl">
                My Personal Podium
              </h2>
            </div>
          </div>

          {hasCompleteTopPicks ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {topPicksResolved.map((slot) => {
                const hotel = slot.hotel;

                if (!hotel) {
                  return null;
                }

                const brand = BRAND_BY_NAME[hotel.brand];
                const brandColor = brand?.color ?? '#1D4ED8';

                return (
                  <article
                    key={`${slot.rank}-${hotel.id}`}
                    className="relative overflow-hidden rounded-[28px] border border-white/50 bg-[rgba(255,255,255,0.82)] shadow-[0_20px_60px_rgba(26,74,122,0.16)]"
                  >
                    <div className="relative h-48 sm:h-52">
                      {slot.imageUrl ? (
                        <img
                          src={slot.imageUrl}
                          alt={hotel.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="h-full w-full"
                          style={{
                            background: `radial-gradient(circle at top left, ${brandColor}66, transparent 34%), linear-gradient(135deg, ${brandColor}26, rgba(18,42,68,0.18))`
                          }}
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[rgba(12,24,40,0.84)] via-[rgba(12,24,40,0.24)] to-transparent" />
                      <div className="absolute left-4 top-4 rounded-full border border-white/70 bg-[rgba(255,255,255,0.78)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--wine))] shadow-[0_10px_24px_rgba(12,24,40,0.18)] backdrop-blur-md">
                        No. {slot.rank}
                      </div>
                      <div className="absolute bottom-4 left-4 right-4">
                        <div className="text-2xl font-semibold leading-tight text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.42)]">
                          {hotel.name}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 rounded-[22px] border border-dashed border-[rgba(0,102,179,0.16)] bg-white/58 p-5 text-sm text-[rgba(34,58,86,0.62)]">
              Click Top 3 Hotels to set up your personal podium.
            </div>
          )}
        </section>
        ) : null}

        {displayPreferences.showTopSuites ? (
        <section className="glass-panel rounded-[28px] px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <button
                type="button"
                onClick={openTopSuitesModal}
                className="section-label transition hover:text-[rgb(var(--wine))]"
              >
                Top 3 Suites
              </button>
              <h2 className="mt-2 text-2xl font-semibold text-[rgb(var(--page-foreground))] font-[family:var(--font-display)] sm:text-3xl">
                My Personal Favorite
              </h2>
            </div>
          </div>

          {hasCompleteTopSuites ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {topSuitesResolved.map((slot) => {
                const hotel = slot.hotel;

                if (!hotel) {
                  return null;
                }

                const brand = BRAND_BY_NAME[hotel.brand];
                const brandColor = brand?.color ?? '#1D4ED8';

                return (
                  <article
                    key={`${slot.rank}-${hotel.id}-${slot.suiteName}`}
                    className="relative overflow-hidden rounded-[28px] border border-white/50 bg-[rgba(255,255,255,0.82)] shadow-[0_20px_60px_rgba(26,74,122,0.16)]"
                  >
                    <div className="relative h-48 sm:h-52">
                      {slot.imageUrl ? (
                        <img
                          src={slot.imageUrl}
                          alt={`${hotel.name} ${slot.suiteName}`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="h-full w-full"
                          style={{
                            background: `radial-gradient(circle at top left, ${brandColor}66, transparent 34%), linear-gradient(135deg, ${brandColor}26, rgba(18,42,68,0.18))`
                          }}
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,18,32,0.92)] via-[rgba(12,24,40,0.34)] to-transparent" />
                      <div className="absolute left-4 top-4 rounded-full border border-white/70 bg-[rgba(255,255,255,0.78)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--wine))] shadow-[0_10px_24px_rgba(12,24,40,0.18)] backdrop-blur-md">
                        No. {slot.rank}
                      </div>
                      <div className="absolute bottom-4 left-4 right-4">
                        <div className="text-xl font-semibold leading-tight text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.5)]">
                          {hotel.name}
                        </div>
                        <div className="mt-2 inline-flex max-w-full rounded-full border border-white/20 bg-white/18 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-sm">
                          {slot.suiteName}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 rounded-[22px] border border-dashed border-[rgba(0,102,179,0.16)] bg-white/58 p-5 text-sm text-[rgba(34,58,86,0.62)]">
              Click Top 3 Suites to set up your favorite suites.
            </div>
          )}
        </section>
        ) : null}

        {displayPreferences.showTierBoard ? (
        <section className="glass-panel rounded-[28px] px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex items-center justify-between gap-3">
            <p className="section-label">Tier Board</p>
          </div>

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
                    className={`tier-shell rounded-[24px] ${
                      isCompactMode ? 'min-h-[104px] bg-white/92 p-2.5 sm:min-h-[112px] sm:p-3' : `bg-gradient-to-r ${tierStyle.panel} p-3.5 sm:p-4`
                    }`}
                    style={{
                      outline:
                        dropTarget?.stayType === 'EXPLORED' && dropTarget.tier === tier
                          ? '2px solid rgba(0,102,179,0.18)'
                          : 'none',
                      outlineOffset: '3px'
                    }}
                  >
                    <div className={isCompactMode ? 'grid gap-2 md:grid-cols-[68px_minmax(0,1fr)] md:items-stretch' : ''}>
                      <div className={isCompactMode ? 'flex md:block' : 'flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'}>
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex shrink-0 items-center justify-center font-bold ${tierStyle.badge} ${
                              isCompactMode ? 'h-[56px] w-[56px] rounded-[18px] text-xl' : 'h-11 w-11 rounded-2xl text-lg'
                            }`}
                          >
                            {tier}
                          </div>
                          {!isCompactMode ? (
                            <div className="text-base font-semibold text-[rgb(var(--page-foreground))] sm:text-lg">
                              {tier}-Tier
                            </div>
                          ) : null}
                        </div>

                        {!isCompactMode ? (
                          <div className="rounded-full border border-white/80 bg-white/75 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[rgba(34,58,86,0.58)] sm:px-3 sm:text-xs sm:tracking-[0.18em]">
                            {tierHotels.length} hotel{tierHotels.length === 1 ? '' : 's'}
                          </div>
                        ) : null}
                      </div>

                      <div className={isCompactMode ? 'mt-2 flex min-h-[72px] flex-wrap content-start gap-1.5 md:mt-0 sm:min-h-[80px]' : 'mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5'}>
                      {tierHotels.length === 0 ? (
                        <div className="rounded-[18px] border border-dashed border-[rgba(0,102,179,0.16)] bg-white/55 p-4 text-sm text-[rgba(34,58,86,0.58)]">
                          {tierStyle.empty}
                        </div>
                      ) : (
                        tierHotels.map((hotel) => {
                          const brandColor = BRAND_BY_NAME[hotel.brand]?.color || '#7A1F2C';
                          const brandStyle = getBrandVisualStyle(hotel.brand, brandColor);

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
                              className={`group border-2 text-left transition hover:-translate-y-0.5 hover:shadow-[0_14px_26px_rgba(26,74,122,0.11)] ${
                                isCompactMode ? 'rounded-[10px] px-2.5 py-1.5' : 'min-h-[68px] rounded-[16px] px-3 py-2.5 sm:min-h-[72px]'
                              }`}
                              style={{
                                borderColor:
                                  dropTarget?.stayType === 'EXPLORED' &&
                                  dropTarget.tier === tier &&
                                  dropTarget.beforeHotelId === hotel.id
                                    ? `${brandColor}BB`
                                    : brandStyle.borderColor,
                                background: isCompactMode
                                  ? `linear-gradient(135deg, ${rgba(brandStyle.dotColor, 0.16)} 0%, rgba(255,255,255,0.96) 70%)`
                                  : brandStyle.background,
                                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.8), 0 14px 30px ${brandStyle.shadowColor}`,
                                opacity: draggedHotelId === hotel.id ? 0.55 : 1,
                                cursor: draggedHotelId === hotel.id ? 'grabbing' : 'grab'
                              }}
                            >
                              <div className={`flex ${isCompactMode ? 'items-center justify-start' : 'items-start justify-between'} gap-2.5`}>
                                <div>
                                  <div className={`text-[rgb(var(--page-foreground))] transition group-hover:text-[rgb(var(--wine))] ${
                                    isCompactMode
                                      ? 'whitespace-nowrap text-[0.72rem] font-semibold leading-none sm:text-xs'
                                      : 'line-clamp-2 text-[0.94rem] font-semibold leading-[1.3] sm:text-[0.98rem]'
                                  }`}>
                                    {hotel.name}
                                  </div>
                                </div>

                                {!isCompactMode ? (
                                  <div className="mt-0.5 flex shrink-0 items-center gap-1.5">
                                    {hotel.roomEntries.length > 0 ? (
                                      <span
                                        className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full border border-[rgba(34,58,86,0.12)] bg-[rgba(34,58,86,0.08)] px-1 text-[0.55rem] font-semibold leading-none text-[rgba(34,58,86,0.72)]"
                                        aria-label={`${hotel.roomEntries.length} logged room${hotel.roomEntries.length === 1 ? '' : 's'}`}
                                      >
                                        {hotel.roomEntries.length}
                                      </span>
                                    ) : null}
                                    <span
                                      className="h-4.5 w-4.5 rounded-full border border-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
                                      style={{ backgroundColor: brandStyle.dotColor }}
                                      aria-label={`${hotel.brand} brand color`}
                                    />
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })
                      )}
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>

            <aside className="tier-shell rounded-[24px] bg-white/74 p-4">
              <button
                type="button"
                onClick={() => setIsExploredBrandsOpen(true)}
                className="section-label transition hover:text-[rgb(var(--wine))]"
              >
                Brands Explored
              </button>
              <div className="mt-3 flex flex-wrap gap-2.5 xl:flex-col xl:gap-2">
                {mappedBrands.length ? (
                  mappedBrands.map((brand) => (
                    (() => {
                      const brandStyle = getBrandVisualStyle(brand.name, brand.color);

                      return (
                    <button
                      key={brand.name}
                      type="button"
                      onClick={() => setSelectedBrandName(brand.name)}
                      className="inline-flex w-full items-start justify-start gap-2 rounded-full border px-3 py-2 text-left text-[0.65rem] font-semibold uppercase tracking-[0.1em] shadow-[0_10px_22px_rgba(26,74,122,0.06)] sm:text-xs sm:tracking-[0.12em]"
                      style={{
                        borderColor: brandStyle.borderColor,
                        background: brandStyle.background,
                        color: brandStyle.labelColor,
                        boxShadow: `0 10px 22px ${brandStyle.shadowColor}`
                      }}
                    >
                      <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: brandStyle.dotColor }} />
                      {brand.name}
                    </button>
                    );})()
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
        ) : null}

        {displayPreferences.showFutureHotels ? (
        <section className="glass-panel rounded-[28px] px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="section-label">Planned Hotel Explorations</p>
            </div>
            {!isCompactMode ? (
              <div className="rounded-full border border-white/80 bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(34,58,86,0.58)]">
                {futureHotels.length} planned hotel exploration{futureHotels.length === 1 ? '' : 's'}
              </div>
            ) : null}
          </div>

          <div
            className={`mt-4 rounded-[24px] border border-dashed border-[rgba(0,102,179,0.14)] ${
              isCompactMode ? 'bg-white/78 p-2.5 sm:p-3' : 'bg-white/40 p-3 sm:p-4'
            }`}
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
            <div className={isCompactMode ? 'flex min-h-[72px] flex-wrap content-start gap-1.5 sm:min-h-[80px]' : 'mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5'}>
              {futureHotels.length ? (
                futureHotels.map((hotel) => {
                  const brandColor = BRAND_BY_NAME[hotel.brand]?.color || '#7A1F2C';
                  const brandStyle = getBrandVisualStyle(hotel.brand, brandColor);

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
                      className={`group border-2 text-left transition hover:-translate-y-0.5 hover:shadow-[0_14px_26px_rgba(26,74,122,0.11)] ${
                        isCompactMode ? 'rounded-[10px] px-2.5 py-1.5' : 'min-h-[68px] rounded-[16px] px-3 py-2.5 sm:min-h-[72px]'
                      }`}
                      style={{
                        borderColor: dropTarget?.stayType === 'FUTURE' && dropTarget.beforeHotelId === hotel.id ? `${brandColor}BB` : brandStyle.borderColor,
                        background: isCompactMode
                          ? `linear-gradient(135deg, ${rgba(brandStyle.dotColor, 0.16)} 0%, rgba(255,255,255,0.96) 70%)`
                          : brandStyle.background,
                        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.8), 0 14px 30px ${brandStyle.shadowColor}`,
                        opacity: draggedHotelId === hotel.id ? 0.55 : 1,
                        cursor: draggedHotelId === hotel.id ? 'grabbing' : 'grab'
                      }}
                    >
                      <div className={`flex ${isCompactMode ? 'items-center justify-start' : 'items-start justify-between'} gap-2.5`}>
                        <div>
                          <div className={`text-[rgb(var(--page-foreground))] transition group-hover:text-[rgb(var(--wine))] ${
                            isCompactMode
                              ? 'whitespace-nowrap text-[0.72rem] font-semibold leading-none sm:text-xs'
                              : 'line-clamp-2 text-[0.94rem] font-semibold leading-[1.3] sm:text-[0.98rem]'
                          }`}>
                            {hotel.name}
                          </div>
                        </div>
                        {!isCompactMode ? (
                          <div className="mt-0.5 flex shrink-0 items-center gap-1.5">
                            {hotel.roomEntries.length > 0 ? (
                              <span
                                className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full border border-[rgba(34,58,86,0.12)] bg-[rgba(34,58,86,0.08)] px-1 text-[0.55rem] font-semibold leading-none text-[rgba(34,58,86,0.72)]"
                                aria-label={`${hotel.roomEntries.length} logged room${hotel.roomEntries.length === 1 ? '' : 's'}`}
                              >
                                {hotel.roomEntries.length}
                              </span>
                            ) : null}
                            <span
                              className="h-4.5 w-4.5 rounded-full border border-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
                              style={{ backgroundColor: brandStyle.dotColor }}
                              aria-label={`${hotel.brand} brand color`}
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-[18px] border border-dashed border-[rgba(0,102,179,0.16)] bg-white/55 p-4 text-sm text-[rgba(34,58,86,0.58)]">
                  No planned hotel explorations yet.
                </div>
              )}
            </div>
          </div>
        </section>
        ) : null}
      </div>

      {isMenuOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(42,18,22,0.48)] px-4 py-8 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-2xl rounded-[30px] p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label">Menu</p>
                <h2 className="mt-2 text-2xl font-semibold leading-none text-[rgb(var(--page-foreground))] font-[family:var(--font-display)] sm:text-4xl">
                  Customize your dashboard
                </h2>
                <div className="mt-2 text-sm text-[rgba(34,58,86,0.62)]">
                  Show or hide sections, and switch compact mode for the tier boards.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(118,31,47,0.16)] bg-white/80 text-lg text-[rgb(var(--wine))] transition hover:bg-[rgba(118,31,47,0.06)]"
                aria-label="Close menu"
              >
                ×
              </button>
            </div>

            <div className="mt-6 space-y-3">
              <div className="rounded-[22px] border border-[rgba(118,31,47,0.1)] bg-white/65 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Top 3 Hotels</div>
                    <div className="mt-1 text-sm text-[rgba(34,58,86,0.62)]">Show or hide your hotel podium.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setDisplayPreferences((current) => ({ ...current, showTopHotels: !current.showTopHotels }))
                    }
                    className="rounded-full border border-[rgba(0,102,179,0.18)] bg-white/85 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--wine))]"
                  >
                    {displayPreferences.showTopHotels ? 'Shown' : 'Hidden'}
                  </button>
                </div>
              </div>

              <div className="rounded-[22px] border border-[rgba(118,31,47,0.1)] bg-white/65 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Top 3 Suites</div>
                    <div className="mt-1 text-sm text-[rgba(34,58,86,0.62)]">Show or hide your suite favorites.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setDisplayPreferences((current) => ({ ...current, showTopSuites: !current.showTopSuites }))
                    }
                    className="rounded-full border border-[rgba(0,102,179,0.18)] bg-white/85 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--wine))]"
                  >
                    {displayPreferences.showTopSuites ? 'Shown' : 'Hidden'}
                  </button>
                </div>
              </div>

              <div className="rounded-[22px] border border-[rgba(118,31,47,0.1)] bg-white/65 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Tier Board</div>
                    <div className="mt-1 text-sm text-[rgba(34,58,86,0.62)]">Control visibility and compact mode together.</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setDisplayPreferences((current) => ({ ...current, showTierBoard: !current.showTierBoard }))
                      }
                      className="rounded-full border border-[rgba(0,102,179,0.18)] bg-white/85 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--wine))]"
                    >
                      {displayPreferences.showTierBoard ? 'Shown' : 'Hidden'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCompactMode((current) => !current)}
                      aria-pressed={isCompactMode}
                      className="rounded-full border border-[rgba(0,102,179,0.18)] bg-white/85 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--wine))]"
                    >
                      {isCompactMode ? 'Compact on' : 'Compact off'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-[22px] border border-[rgba(118,31,47,0.1)] bg-white/65 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Planned Hotel Explorations</div>
                    <div className="mt-1 text-sm text-[rgba(34,58,86,0.62)]">Show or hide your future stays board.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setDisplayPreferences((current) => ({ ...current, showFutureHotels: !current.showFutureHotels }))
                    }
                    className="rounded-full border border-[rgba(0,102,179,0.18)] bg-white/85 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--wine))]"
                  >
                    {displayPreferences.showFutureHotels ? 'Shown' : 'Hidden'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {selectedBrand && selectedBrandHotels.length ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(42,18,22,0.48)] px-4 py-8 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-3xl rounded-[30px] p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label">Hyatt Brands</p>
                <h2 className="mt-2 text-3xl font-semibold leading-none text-[rgb(var(--page-foreground))] font-[family:var(--font-display)] sm:text-4xl">
                  {selectedBrand.name}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedBrandName(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(118,31,47,0.16)] bg-white/80 text-lg text-[rgb(var(--wine))] transition hover:bg-[rgba(118,31,47,0.06)]"
                aria-label="Close brand hotels"
              >
                ×
              </button>
            </div>

            <div className="mt-6 max-h-[70vh] space-y-5 overflow-auto pr-1">
              {(['EXPLORED', 'FUTURE'] as const).map((stayType) => {
                const brandHotels = selectedBrandHotels.filter((hotel) => hotel.stayType === stayType);

                if (!brandHotels.length) {
                  return null;
                }

                return (
                  <section key={stayType} className="rounded-[24px] border border-[rgba(0,102,179,0.12)] bg-white/68 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[rgba(34,58,86,0.58)]">
                        {stayType === 'EXPLORED' ? 'Explored' : 'Planned'}
                      </div>
                      <div className="rounded-full border border-white/80 bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[rgba(34,58,86,0.58)]">
                        {brandHotels.length}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {brandHotels.map((hotel) => (
                        <div
                          key={hotel.id}
                          className="rounded-[20px] border p-4"
                          style={{
                            borderColor: `${selectedBrand.color}22`,
                            backgroundColor: `${selectedBrand.color}0D`
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-base font-semibold text-[rgb(var(--page-foreground))]">
                                {hotel.name}
                              </div>
                              <div className="mt-1 text-xs uppercase tracking-[0.14em] text-[rgba(34,58,86,0.52)]">
                                {stayType === 'EXPLORED'
                                  ? `${hotel.tier ?? 'Unranked'}${hotel.tier ? '-Tier' : ''}`
                                  : 'Planned'}
                              </div>
                              {hotel.roomEntries.length ? (
                                <div className="mt-2 text-sm text-[rgba(34,58,86,0.68)]">
                                  {formatRoomEntries(hotel.roomEntries)}
                                </div>
                              ) : null}
                            </div>

                            <div className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-[rgba(34,58,86,0.12)] bg-white/75 px-2 text-xs font-semibold text-[rgba(34,58,86,0.72)]">
                              {hotel.roomEntries.length}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {isAllBrandsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(42,18,22,0.48)] px-4 py-8 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-4xl rounded-[30px] p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label">Brand Palette</p>
                <h2 className="mt-2 text-2xl font-semibold leading-none text-[rgb(var(--page-foreground))] font-[family:var(--font-display)] sm:text-4xl">
                  Hyatt brands and colors
                </h2>
                <div className="mt-2 text-sm text-[rgba(34,58,86,0.62)]">
                  All 38 brands in their full brand color.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAllBrandsOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(118,31,47,0.16)] bg-white/80 text-lg text-[rgb(var(--wine))] transition hover:bg-[rgba(118,31,47,0.06)]"
                aria-label="Close all brands"
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
                        (() => {
                          const brandStyle = getBrandVisualStyle(brand.name, brand.color);

                          return (
                        <div
                          key={brand.name}
                          className="rounded-full border px-3 py-2 text-xs font-semibold shadow-[0_10px_22px_rgba(81,39,43,0.08)]"
                          style={{
                            borderColor: brandStyle.borderColor,
                            background: brandStyle.background,
                            color: brandStyle.labelColor,
                            boxShadow: `0 10px 22px ${brandStyle.shadowColor}`
                          }}
                        >
                          {brand.name}
                        </div>
                        );})()
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isExploredBrandsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(42,18,22,0.48)] px-4 py-8 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-4xl rounded-[30px] p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label">Brands Explored</p>
                <h2 className="mt-2 text-2xl font-semibold leading-none text-[rgb(var(--page-foreground))] font-[family:var(--font-display)] sm:text-4xl">
                  All Hyatt brands
                </h2>
                <div className="mt-2 text-sm text-[rgba(34,58,86,0.62)]">
                  Explored brands keep their color. Everything else stays grey.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsExploredBrandsOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(118,31,47,0.16)] bg-white/80 text-lg text-[rgb(var(--wine))] transition hover:bg-[rgba(118,31,47,0.06)]"
                aria-label="Close explored brands"
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
                      {brands.map((brand) => {
                        const isExplored = exploredBrandNames.has(brand.name);
                        const brandStyle = getBrandVisualStyle(brand.name, brand.color);

                        return (
                        <button
                          key={brand.name}
                          type="button"
                          onClick={() => {
                            if (isExplored) {
                              setIsExploredBrandsOpen(false);
                              setSelectedBrandName(brand.name);
                            }
                          }}
                          disabled={!isExplored}
                          className="rounded-full border px-3 py-2 text-xs font-semibold shadow-[0_10px_22px_rgba(81,39,43,0.08)] transition disabled:cursor-default disabled:shadow-none"
                          style={{
                            borderColor: isExplored ? brandStyle.borderColor : 'rgba(148,163,184,0.22)',
                            background: isExplored ? brandStyle.background : 'rgba(148,163,184,0.12)',
                            color: isExplored ? brandStyle.labelColor : '#94A3B8',
                            boxShadow: isExplored ? `0 10px 22px ${brandStyle.shadowColor}` : 'none'
                          }}
                        >
                          {brand.name}
                        </button>
                      );})}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isFutureBrandsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(42,18,22,0.48)] px-4 py-8 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-3xl rounded-[30px] p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label">Planned Brand Explorations</p>
                <h2 className="mt-2 text-2xl font-semibold leading-none text-[rgb(var(--page-foreground))] font-[family:var(--font-display)] sm:text-4xl">
                  Future brands on deck
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsFutureBrandsOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(118,31,47,0.16)] bg-white/80 text-lg text-[rgb(var(--wine))] transition hover:bg-[rgba(118,31,47,0.06)]"
                aria-label="Close planned brand explorations"
              >
                ×
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {futureExploringBrands.map((brand) => {
                const style = getBrandVisualStyle(brand.name, brand.color);

                return (
                  <div
                    key={brand.name}
                    className="rounded-[22px] border p-4"
                    style={{
                      borderColor: style.borderColor,
                      background: style.background
                    }}
                  >
                    <div className="text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: style.labelColor }}>
                      {brand.segment}
                    </div>
                    <div className="mt-2 text-xl font-semibold text-[rgb(var(--page-foreground))]">
                      {brand.name}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {isSuitesOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(42,18,22,0.48)] px-4 py-8 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-3xl rounded-[30px] p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label">Suites Explored</p>
                <h2 className="mt-2 text-2xl font-semibold leading-none text-[rgb(var(--page-foreground))] font-[family:var(--font-display)] sm:text-4xl">
                  Every suite you logged
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsSuitesOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(118,31,47,0.16)] bg-white/80 text-lg text-[rgb(var(--wine))] transition hover:bg-[rgba(118,31,47,0.06)]"
                aria-label="Close suites explored"
              >
                ×
              </button>
            </div>

            <div className="mt-6 max-h-[70vh] space-y-3 overflow-auto pr-1">
              {exploredSuites.map((suite) => {
                const brand = BRAND_BY_NAME[suite.brand];
                const style = getBrandVisualStyle(suite.brand, brand?.color ?? '#1D4ED8');

                return (
                  <div
                    key={`${suite.hotelName}-${suite.suiteName}`}
                    className="rounded-[22px] border p-4"
                    style={{ borderColor: style.borderColor, background: style.background }}
                  >
                    <div className="text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: style.labelColor }}>
                      {suite.hotelName}
                    </div>
                    <div className="mt-2 text-xl font-semibold text-[rgb(var(--page-foreground))]">
                      {suite.suiteName}
                    </div>
                    <div className="mt-2 text-sm text-[rgba(34,58,86,0.62)]">
                      {suite.brand} {suite.tier ? `• ${suite.tier}-Tier` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {isTopPicksOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(42,18,22,0.48)] px-4 py-8 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-3xl rounded-[30px] p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label">Top 3 Hotels</p>
                <h2 className="mt-2 text-2xl font-semibold leading-none text-[rgb(var(--page-foreground))] font-[family:var(--font-display)] sm:text-4xl">
                  Build your podium
                </h2>
                <div className="mt-2 text-sm text-[rgba(34,58,86,0.62)]">
                  Pick your three best explored hotels. You can also paste a photo URL if you want image cards.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTopPicksOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(118,31,47,0.16)] bg-white/80 text-lg text-[rgb(var(--wine))] transition hover:bg-[rgba(118,31,47,0.06)]"
                aria-label="Close top 3 hotels"
              >
                ×
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {topPicksDraft.map((slot, index) => (
                <div key={slot.rank} className="rounded-[24px] border border-[rgba(0,102,179,0.1)] bg-white/68 p-4">
                  <div className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-[rgba(34,58,86,0.58)]">
                    Rank #{slot.rank}
                  </div>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Hotel</span>
                      <select
                        value={slot.hotelId}
                        onChange={(event) =>
                          setTopPicksDraft((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, hotelId: event.target.value } : item
                            )
                          )
                        }
                        className="w-full rounded-[16px] border border-[rgba(118,31,47,0.14)] bg-white/90 px-4 py-3 text-sm text-[rgb(var(--page-foreground))] outline-none transition focus:border-[rgba(118,31,47,0.32)] focus:ring-4 focus:ring-[rgba(118,31,47,0.08)]"
                      >
                        <option value="">Select a hotel</option>
                        {exploredHotels.map((hotel) => (
                          <option key={hotel.id} value={hotel.id}>
                            {hotel.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Photo URL</span>
                      <input
                        value={slot.imageUrl}
                        onChange={(event) =>
                          setTopPicksDraft((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, imageUrl: event.target.value } : item
                            )
                          )
                        }
                        placeholder="Paste an image URL"
                        className="w-full rounded-[16px] border border-[rgba(118,31,47,0.14)] bg-white/90 px-4 py-3 text-sm text-[rgb(var(--page-foreground))] outline-none transition focus:border-[rgba(118,31,47,0.32)] focus:ring-4 focus:ring-[rgba(118,31,47,0.08)]"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            {topPicksError ? (
              <div className="mt-4 rounded-[18px] border border-[rgba(118,31,47,0.18)] bg-[rgba(118,31,47,0.06)] px-4 py-3 text-sm text-[rgb(var(--wine))]">
                {topPicksError}
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsTopPicksOpen(false)}
                className="rounded-full border border-[rgba(118,31,47,0.16)] bg-white/82 px-5 py-2.5 text-sm font-semibold text-[rgb(var(--page-foreground))] transition hover:bg-[rgba(118,31,47,0.06)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTopPicks}
                className="rounded-full bg-[rgb(var(--wine))] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#004f8d]"
              >
                Save top 3
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isTopSuitesOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(42,18,22,0.48)] px-4 py-8 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-4xl rounded-[30px] p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label">Top 3 Suites</p>
                <h2 className="mt-2 text-2xl font-semibold leading-none text-[rgb(var(--page-foreground))] font-[family:var(--font-display)] sm:text-4xl">
                  Build your favorites
                </h2>
                <div className="mt-2 text-sm text-[rgba(34,58,86,0.62)]">
                  Pick your three favorite suites, add the suite name, and optionally paste a photo URL.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTopSuitesOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(118,31,47,0.16)] bg-white/80 text-lg text-[rgb(var(--wine))] transition hover:bg-[rgba(118,31,47,0.06)]"
                aria-label="Close top 3 suites"
              >
                ×
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {topSuitesDraft.map((slot, index) => {
                const suiteOptions = exploredHotelsWithSuites
                  .find((hotel) => hotel.id === slot.hotelId)
                  ?.roomEntries.filter((entry) => entry.kind === 'SUITE')
                  .map((entry) => entry.label) ?? [];

                return (
                  <div key={slot.rank} className="rounded-[24px] border border-[rgba(0,102,179,0.1)] bg-white/68 p-4">
                    <div className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-[rgba(34,58,86,0.58)]">
                      Rank #{slot.rank}
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Hotel</span>
                        <select
                          value={slot.hotelId}
                          onChange={(event) =>
                            setTopSuitesDraft((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, hotelId: event.target.value, suiteName: '' } : item
                              )
                            )
                          }
                          className="w-full rounded-[16px] border border-[rgba(118,31,47,0.14)] bg-white/90 px-4 py-3 text-sm text-[rgb(var(--page-foreground))] outline-none transition focus:border-[rgba(118,31,47,0.32)] focus:ring-4 focus:ring-[rgba(118,31,47,0.08)]"
                        >
                          <option value="">Select a hotel</option>
                          {exploredHotelsWithSuites.map((hotel) => (
                            <option key={hotel.id} value={hotel.id}>
                              {hotel.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Suite</span>
                        <>
                          <input
                            value={slot.suiteName}
                            onChange={(event) =>
                              setTopSuitesDraft((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, suiteName: event.target.value } : item
                                )
                              )
                            }
                            list={`suite-options-${slot.rank}`}
                            placeholder="Type the suite name"
                            className="w-full rounded-[16px] border border-[rgba(118,31,47,0.14)] bg-white/90 px-4 py-3 text-sm text-[rgb(var(--page-foreground))] outline-none transition focus:border-[rgba(118,31,47,0.32)] focus:ring-4 focus:ring-[rgba(118,31,47,0.08)]"
                          />
                          <datalist id={`suite-options-${slot.rank}`}>
                            {suiteOptions.map((suiteName) => (
                              <option key={suiteName} value={suiteName} />
                            ))}
                          </datalist>
                        </>
                      </label>

                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Photo URL</span>
                        <input
                          value={slot.imageUrl}
                          onChange={(event) =>
                            setTopSuitesDraft((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, imageUrl: event.target.value } : item
                              )
                            )
                          }
                          placeholder="Paste an image URL"
                          className="w-full rounded-[16px] border border-[rgba(118,31,47,0.14)] bg-white/90 px-4 py-3 text-sm text-[rgb(var(--page-foreground))] outline-none transition focus:border-[rgba(118,31,47,0.32)] focus:ring-4 focus:ring-[rgba(118,31,47,0.08)]"
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            {topSuitesError ? (
              <div className="mt-4 rounded-[18px] border border-[rgba(118,31,47,0.18)] bg-[rgba(118,31,47,0.06)] px-4 py-3 text-sm text-[rgb(var(--wine))]">
                {topSuitesError}
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsTopSuitesOpen(false)}
                className="rounded-full border border-[rgba(118,31,47,0.16)] bg-white/82 px-5 py-2.5 text-sm font-semibold text-[rgb(var(--page-foreground))] transition hover:bg-[rgba(118,31,47,0.06)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTopSuites}
                className="rounded-full bg-[rgb(var(--wine))] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#004f8d]"
              >
                Save top 3 suites
              </button>
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
            className="glass-panel max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-[30px] p-5 sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label">{modalState.mode === 'edit' ? 'Edit Hotel' : 'Add Hotel'}</p>
                {modalState.mode === 'edit' ? (
                  <h2 className="mt-2 text-3xl font-semibold leading-none text-[rgb(var(--page-foreground))] font-[family:var(--font-display)] sm:text-4xl">
                    Update this stay
                  </h2>
                ) : null}
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
                        tier: value === 'EXPLORED' ? current.tier ?? 'S' : null
                      }))
                    }
                    options={STAY_TYPE_OPTIONS}
                  />
                </label>

                {draft.stayType === 'EXPLORED' ? (
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
                ) : null}

                <div className="space-y-3 md:col-span-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Room Type</div>
                      <div className="mt-1 text-xs text-[rgba(34,58,86,0.58)]">
                        {draft.stayType === 'EXPLORED'
                          ? 'Add each room or suite you stayed in for this hotel.'
                          : 'Add planned room or suite types for this hotel.'}
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