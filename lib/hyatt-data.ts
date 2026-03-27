import type { HotelRecord, HyattBrand, StayType, Tier } from './types';

export const TIERS = ['S', 'A', 'B', 'C', 'D'] as const;

export const BRAND_SEGMENTS = [
  'Luxury',
  'Lifestyle',
  'Inclusive',
  'Classics',
  'Essentials',
  'More to Explore'
] as const;

export const HYATT_BRANDS: HyattBrand[] = [
  { name: 'Park Hyatt', color: '#8B1E3F', segment: 'Luxury' },
  { name: 'Alila', color: '#047857', segment: 'Luxury' },
  { name: 'Miraval', color: '#D97706', segment: 'Luxury' },
  { name: 'Impression by Secrets', color: '#7C3AED', segment: 'Luxury' },
  { name: 'The Unbound Collection by Hyatt', color: '#4338CA', segment: 'Luxury' },
  { name: 'Andaz', color: '#E11D48', segment: 'Lifestyle' },
  { name: 'Thompson Hotels', color: '#334155', segment: 'Lifestyle' },
  { name: 'Dream Hotels', color: '#C026D3', segment: 'Lifestyle' },
  { name: 'The Standard', color: '#111827', segment: 'Lifestyle' },
  { name: 'The StandardX', color: '#0369A1', segment: 'Lifestyle' },
  { name: 'JdV by Hyatt', color: '#DC2626', segment: 'Lifestyle' },
  { name: 'Bunkhouse Hotels', color: '#92400E', segment: 'Lifestyle' },
  { name: 'Me and All Hotels', color: '#EA580C', segment: 'Lifestyle' },
  { name: 'Zoetry Wellness & Spa Resorts', color: '#15803D', segment: 'Inclusive' },
  { name: 'Hyatt Ziva', color: '#0891B2', segment: 'Inclusive' },
  { name: 'Hyatt Zilara', color: '#6D28D9', segment: 'Inclusive' },
  { name: 'Secrets Resorts & Spas', color: '#0F766E', segment: 'Inclusive' },
  { name: 'Breathless Resorts & Spas', color: '#DB2777', segment: 'Inclusive' },
  { name: 'Dreams Resorts & Spas', color: '#3B82F6', segment: 'Inclusive' },
  { name: 'Hyatt Vivid Hotels & Resorts', color: '#F43F5E', segment: 'Inclusive' },
  { name: 'Alua Hotels & Resorts', color: '#0284C7', segment: 'Inclusive' },
  { name: 'Sunscape Resorts & Spas', color: '#F59E0B', segment: 'Inclusive' },
  { name: 'Bahia Principle', color: '#A16207', segment: 'Inclusive' },
  { name: 'Grand Hyatt', color: '#991B1B', segment: 'Classics' },
  { name: 'Hyatt Regency', color: '#9D174D', segment: 'Classics' },
  { name: 'Hyatt', color: '#BE123C', segment: 'Classics' },
  { name: 'Hyatt Vacation Club', color: '#1E40AF', segment: 'Classics' },
  { name: 'Hyatt Centric', color: '#C2410C', segment: 'Classics' },
  { name: 'Destination by Hyatt', color: '#166534', segment: 'Classics' },
  { name: 'Caption by Hyatt', color: '#CA8A04', segment: 'Essentials' },
  { name: 'Hyatt Place', color: '#2563EB', segment: 'Essentials' },
  { name: 'Hyatt House', color: '#4D7C0F', segment: 'Essentials' },
  { name: 'Hyatt Studios', color: '#7E22CE', segment: 'Essentials' },
  { name: 'Hyatt Select', color: '#0EA5E9', segment: 'Essentials' },
  { name: 'UrCove', color: '#0D9488', segment: 'Essentials' },
  { name: 'Unscripted by Hyatt', color: '#65A30D', segment: 'Essentials' },
  { name: 'Mr & Mrs Smith', color: '#6B21A8', segment: 'More to Explore' },
  { name: 'The Venetian Resort', color: '#A8550F', segment: 'More to Explore' }
];

export const BRAND_BY_NAME = Object.fromEntries(
  HYATT_BRANDS.map((brand) => [brand.name, brand])
) as Record<string, HyattBrand>;

export const BRANDS_BY_SEGMENT = BRAND_SEGMENTS.map((segment) => ({
  segment,
  brands: HYATT_BRANDS.filter((brand) => brand.segment === segment)
}));

const TIER_WEIGHT: Record<Tier, number> = {
  S: 0,
  A: 1,
  B: 2,
  C: 3,
  D: 4
};

const STAY_TYPE_WEIGHT: Record<StayType, number> = {
  EXPLORED: 0,
  FUTURE: 1
};

export function sortHotelsByTier(hotels: HotelRecord[]) {
  return [...hotels].sort((left, right) => {
    const byStayType = STAY_TYPE_WEIGHT[left.stayType] - STAY_TYPE_WEIGHT[right.stayType];

    if (byStayType !== 0) {
      return byStayType;
    }

    if (left.tier === null && right.tier === null) {
      const byPositionOnly = left.position - right.position;

      if (byPositionOnly !== 0) {
        return byPositionOnly;
      }

      const byNameOnly = left.name.localeCompare(right.name);

      if (byNameOnly !== 0) {
        return byNameOnly;
      }

      return left.brand.localeCompare(right.brand);
    }

    if (left.tier === null) {
      return 1;
    }

    if (right.tier === null) {
      return -1;
    }

    const byTier = TIER_WEIGHT[left.tier] - TIER_WEIGHT[right.tier];

    if (byTier !== 0) {
      return byTier;
    }

    const byPosition = left.position - right.position;

    if (byPosition !== 0) {
      return byPosition;
    }

    const byName = left.name.localeCompare(right.name);

    if (byName !== 0) {
      return byName;
    }

    return left.brand.localeCompare(right.brand);
  });
}