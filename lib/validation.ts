import { z } from 'zod';
import { HYATT_BRANDS, TIERS } from './hyatt-data';

const BRAND_NAMES = HYATT_BRANDS.map((brand) => brand.name) as [string, ...string[]];

export const hotelFormSchema = z.object({
  name: z.string().trim().min(1, 'Hotel name is required').max(120, 'Max 120 characters'),
  brand: z.enum(BRAND_NAMES, {
    errorMap: () => ({ message: 'Choose a Hyatt brand' })
  }),
  tier: z.enum(TIERS, {
    errorMap: () => ({ message: 'Select a tier' })
  })
});

export type HotelFormPayload = z.infer<typeof hotelFormSchema>;

export const hotelReorderSchema = z.object({
  hotels: z.array(
    z.object({
      id: z.string().min(1),
      tier: z.enum(TIERS),
      position: z.number().int().min(0)
    })
  )
});

export type HotelReorderPayload = z.infer<typeof hotelReorderSchema>;