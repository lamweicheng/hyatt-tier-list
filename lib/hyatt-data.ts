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
  { name: 'Park Hyatt', color: '#7A1F2C', segment: 'Luxury' },
  { name: 'Alila', color: '#426B5A', segment: 'Luxury' },
  { name: 'Miraval', color: '#8D5B2E', segment: 'Luxury' },
  { name: 'Impression by Secrets', color: '#7E5F9E', segment: 'Luxury' },
  { name: 'The Unbound Collection by Hyatt', color: '#5E4B8B', segment: 'Luxury' },
  { name: 'Andaz', color: '#B3543A', segment: 'Lifestyle' },
  { name: 'Thompson Hotels', color: '#4B4858', segment: 'Lifestyle' },
  { name: 'Dream Hotels', color: '#A95C86', segment: 'Lifestyle' },
  { name: 'The Standard', color: '#2E2E33', segment: 'Lifestyle' },
  { name: 'The StandardX', color: '#58606A', segment: 'Lifestyle' },
  { name: 'JdV by Hyatt', color: '#C65252', segment: 'Lifestyle' },
  { name: 'Bunkhouse Hotels', color: '#986C48', segment: 'Lifestyle' },
  { name: 'Me and All Hotels', color: '#E26A4B', segment: 'Lifestyle' },
  { name: 'Zoetry Wellness & Spa Resorts', color: '#568C57', segment: 'Inclusive' },
  { name: 'Hyatt Ziva', color: '#149F9B', segment: 'Inclusive' },
  { name: 'Hyatt Zilara', color: '#8759B8', segment: 'Inclusive' },
  { name: 'Secrets Resorts & Spas', color: '#3D7D73', segment: 'Inclusive' },
  { name: 'Breathless Resorts & Spas', color: '#E06A87', segment: 'Inclusive' },
  { name: 'Dreams Resorts & Spas', color: '#5893C8', segment: 'Inclusive' },
  { name: 'Hyatt Vivid Hotels & Resorts', color: '#D16464', segment: 'Inclusive' },
  { name: 'Alua Hotels & Resorts', color: '#287D9D', segment: 'Inclusive' },
  { name: 'Sunscape Resorts & Spas', color: '#F29A4A', segment: 'Inclusive' },
  { name: 'Bahia Principle', color: '#B96933', segment: 'Inclusive' },
  { name: 'Grand Hyatt', color: '#8A2433', segment: 'Classics' },
  { name: 'Hyatt Regency', color: '#6E3342', segment: 'Classics' },
  { name: 'Hyatt', color: '#B33A42', segment: 'Classics' },
  { name: 'Hyatt Vacation Club', color: '#4A6880', segment: 'Classics' },
  { name: 'Hyatt Centric', color: '#C56A2D', segment: 'Classics' },
  { name: 'Destination by Hyatt', color: '#2D6A7A', segment: 'Classics' },
  { name: 'Caption by Hyatt', color: '#D48959', segment: 'Essentials' },
  { name: 'Hyatt Place', color: '#2F73A8', segment: 'Essentials' },
  { name: 'Hyatt House', color: '#4A8550', segment: 'Essentials' },
  { name: 'Hyatt Studios', color: '#7563D4', segment: 'Essentials' },
  { name: 'Hyatt Select', color: '#4A79A6', segment: 'Essentials' },
  { name: 'UrCove', color: '#3D8D7A', segment: 'Essentials' },
  { name: 'Unscripted by Hyatt', color: '#7B714B', segment: 'Essentials' },
  { name: 'Mr & Mrs Smith', color: '#5D4A45', segment: 'More to Explore' },
  { name: 'The Venetian Resort', color: '#9B6B43', segment: 'More to Explore' }
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