import { z } from 'zod';
import { HYATT_BRANDS, TIERS } from './hyatt-data';

const BRAND_NAMES = HYATT_BRANDS.map((brand) => brand.name) as [string, ...string[]];
const STAY_TYPES = ['EXPLORED', 'FUTURE'] as const;
const ROOM_ENTRY_KINDS = ['ROOM', 'SUITE'] as const;

const roomEntrySchema = z.object({
  label: z.string().trim().min(1, 'Room type is required').max(80, 'Max 80 characters'),
  kind: z.enum(ROOM_ENTRY_KINDS)
});

export const hotelFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Hotel name is required').max(120, 'Max 120 characters'),
    brand: z.enum(BRAND_NAMES, {
      errorMap: () => ({ message: 'Choose a Hyatt brand' })
    }),
    stayType: z.enum(STAY_TYPES),
    tier: z.enum(TIERS).nullable(),
    roomEntries: z.array(roomEntrySchema).default([])
  })
  .superRefine((value, ctx) => {
    if (value.stayType === 'EXPLORED' && !value.tier) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tier'],
        message: 'Select a tier'
      });
    }
  })
  .transform((value) => ({
    ...value,
    roomEntries: value.roomEntries.map((entry) => ({
      label: entry.label.trim(),
      kind: entry.kind
    }))
  }));

export type HotelFormPayload = z.infer<typeof hotelFormSchema>;

export const hotelReorderSchema = z.object({
  hotels: z.array(
    z.object({
      id: z.string().min(1),
      stayType: z.enum(STAY_TYPES),
      tier: z.enum(TIERS).nullable(),
      position: z.number().int().min(0)
    })
  )
});

export type HotelReorderPayload = z.infer<typeof hotelReorderSchema>;

const topPickRankSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

const topPickSlotSchema = z.object({
  rank: topPickRankSchema,
  hotelId: z.string(),
  imageUrl: z.string()
});

const topSuiteSlotSchema = z.object({
  rank: topPickRankSchema,
  hotelId: z.string(),
  suiteName: z.string(),
  imageUrl: z.string()
});

const topFutureStaySlotSchema = z.object({
  rank: topPickRankSchema,
  hotelId: z.string(),
  location: z.string(),
  imageUrl: z.string()
});

const topExperienceSlotSchema = z.object({
  rank: topPickRankSchema,
  hotelId: z.string(),
  description: z.string(),
  imageUrl: z.string()
});

const topUnderratedSlotSchema = z.object({
  rank: topPickRankSchema,
  hotelId: z.string(),
  imageUrl: z.string()
});

const topReturnStaySlotSchema = z.object({
  rank: topPickRankSchema,
  hotelId: z.string(),
  imageUrl: z.string()
});

const dashboardSectionIdSchema = z.union([
  z.literal('topHotels'),
  z.literal('topSuites'),
  z.literal('tierBoard'),
  z.literal('futureHotels'),
  z.literal('topFutureStays'),
  z.literal('topExperiences'),
  z.literal('topUnderrated'),
  z.literal('topReturnStays')
]);

const displayPreferencesSchema = z.object({
  showTopHotels: z.boolean(),
  showTopSuites: z.boolean(),
  showTierBoard: z.boolean(),
  showFutureHotels: z.boolean(),
  showTopFutureStays: z.boolean(),
  showTopExperiences: z.boolean(),
  showTopUnderrated: z.boolean(),
  showTopReturnStays: z.boolean(),
  sectionOrder: z.array(dashboardSectionIdSchema).length(8)
});

export const dashboardPreferencesSchema = z.object({
  topPicks: z.array(topPickSlotSchema).length(3),
  topSuites: z.array(topSuiteSlotSchema).length(3),
  topFutureStays: z.array(topFutureStaySlotSchema).length(3),
  topExperiences: z.array(topExperienceSlotSchema).length(3),
  topUnderrated: z.array(topUnderratedSlotSchema).length(3),
  topReturnStays: z.array(topReturnStaySlotSchema).length(3),
  displayPreferences: displayPreferencesSchema
});

export const dashboardPreferencesPatchSchema = dashboardPreferencesSchema.partial();

export type DashboardPreferencesPayload = z.infer<typeof dashboardPreferencesSchema>;
export type DashboardPreferencesPatchPayload = z.infer<typeof dashboardPreferencesPatchSchema>;