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