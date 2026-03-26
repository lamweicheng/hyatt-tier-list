import 'server-only';

import { ZodError } from 'zod';
import { sortHotelsByTier } from './hyatt-data';
import { getPrismaClient } from './prisma';
import type { HotelDraft, HotelRecord } from './types';
import { hotelFormSchema, hotelReorderSchema } from './validation';

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function toHotelRecord(hotel: {
  id: string;
  name: string;
  brand: string;
  tier: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}): HotelRecord {
  return {
    id: hotel.id,
    name: hotel.name,
    brand: hotel.brand,
    tier: hotel.tier as HotelRecord['tier'],
    position: hotel.position,
    createdAt: hotel.createdAt.toISOString(),
    updatedAt: hotel.updatedAt.toISOString()
  };
}

async function getNextHotelPosition(tier: HotelDraft['tier']) {
  const highestPositionHotel = await getPrismaClient().hotel.findFirst({
    where: { tier },
    orderBy: { position: 'desc' },
    select: { position: true }
  });

  return (highestPositionHotel?.position ?? -1) + 1;
}

export async function listHotels() {
  if (!isDatabaseConfigured()) {
    return [] as HotelRecord[];
  }

  const hotels = await getPrismaClient().hotel.findMany({
    orderBy: [{ tier: 'asc' }, { position: 'asc' }, { name: 'asc' }]
  });
  return sortHotelsByTier(hotels.map(toHotelRecord));
}

export async function createHotel(payload: HotelDraft) {
  const data = hotelFormSchema.parse(payload);
  const hotel = await getPrismaClient().hotel.create({
    data: {
      ...data,
      position: await getNextHotelPosition(data.tier)
    }
  });
  return toHotelRecord(hotel);
}

export async function updateHotel(id: string, payload: HotelDraft) {
  const data = hotelFormSchema.parse(payload);
  const existingHotel = await getPrismaClient().hotel.findUniqueOrThrow({
    where: { id },
    select: { tier: true, position: true }
  });

  const nextPosition =
    existingHotel.tier === data.tier ? existingHotel.position : await getNextHotelPosition(data.tier);

  const hotel = await getPrismaClient().hotel.update({
    where: { id },
    data: {
      ...data,
      position: nextPosition
    }
  });

  return toHotelRecord(hotel);
}

export async function deleteHotel(id: string) {
  await getPrismaClient().hotel.delete({
    where: { id }
  });
}

export async function reorderHotels(payload: unknown) {
  const data = hotelReorderSchema.parse(payload);

  await getPrismaClient().$transaction(
    data.hotels.map((hotel) =>
      getPrismaClient().hotel.update({
        where: { id: hotel.id },
        data: {
          tier: hotel.tier,
          position: hotel.position
        }
      })
    )
  );

  return listHotels();
}

export function normalizeRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return {
      status: 400,
      message: error.issues[0]?.message || 'Invalid hotel payload.'
    };
  }

  if (error instanceof Error) {
    return {
      status: 500,
      message: error.message || 'Something went wrong.'
    };
  }

  return {
    status: 500,
    message: 'Something went wrong.'
  };
}