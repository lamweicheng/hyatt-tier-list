import 'server-only';

import { ZodError } from 'zod';
import { sortHotelsByTier } from './hyatt-data';
import { getPrismaClient } from './prisma';
import type { HotelDraft, HotelRecord, RoomEntry, StayEntry } from './types';
import { hotelFormSchema, hotelReorderSchema } from './validation';

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function toHotelRecord(hotel: {
  id: string;
  name: string;
  brand: string;
  stayType: string;
  tier: string | null;
  roomEntries: unknown;
  stayEntries: unknown;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}): HotelRecord {
  const roomEntries = Array.isArray(hotel.roomEntries)
    ? hotel.roomEntries
        .filter((entry): entry is RoomEntry => {
          if (typeof entry !== 'object' || entry === null) {
            return false;
          }

          const record = entry as Record<string, unknown>;
          return typeof record.label === 'string' && (record.kind === 'ROOM' || record.kind === 'SUITE');
        })
        .map((entry) => ({
          label: entry.label,
          kind: entry.kind
        }))
    : [];

  const stayEntries = Array.isArray(hotel.stayEntries)
    ? hotel.stayEntries
        .filter((entry): entry is StayEntry => {
          if (typeof entry !== 'object' || entry === null) {
            return false;
          }

          const record = entry as Record<string, unknown>;
          return (
            typeof record.id === 'string' &&
            typeof record.month === 'number' &&
            Number.isInteger(record.month) &&
            record.month >= 1 &&
            record.month <= 12 &&
            typeof record.year === 'number' &&
            Number.isInteger(record.year)
          );
        })
        .map((entry) => ({
          id: entry.id,
          month: entry.month,
          year: entry.year
        }))
    : [];

  return {
    id: hotel.id,
    name: hotel.name,
    brand: hotel.brand,
    stayType: hotel.stayType as HotelRecord['stayType'],
    tier: hotel.tier as HotelRecord['tier'],
    roomEntries,
    stayEntries,
    position: hotel.position,
    createdAt: hotel.createdAt.toISOString(),
    updatedAt: hotel.updatedAt.toISOString()
  };
}

async function getNextHotelPosition(stayType: HotelDraft['stayType'], tier: HotelDraft['tier']) {
  const highestPositionHotel = await getPrismaClient().hotel.findFirst({
    where: { stayType, tier },
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
    orderBy: [{ stayType: 'asc' }, { tier: 'asc' }, { position: 'asc' }, { name: 'asc' }]
  });
  return sortHotelsByTier(hotels.map(toHotelRecord));
}

export async function createHotel(payload: HotelDraft) {
  const data = hotelFormSchema.parse(payload);
  const hotel = await getPrismaClient().hotel.create({
    data: {
      ...data,
      position: await getNextHotelPosition(data.stayType, data.tier),
      roomEntries: data.roomEntries,
      stayEntries: data.stayEntries
    }
  });
  return toHotelRecord(hotel);
}

export async function updateHotel(id: string, payload: HotelDraft) {
  const data = hotelFormSchema.parse(payload);
  const existingHotel = await getPrismaClient().hotel.findUniqueOrThrow({
    where: { id },
    select: { stayType: true, tier: true, position: true }
  });

  const nextPosition =
    existingHotel.stayType === data.stayType && existingHotel.tier === data.tier
      ? existingHotel.position
      : await getNextHotelPosition(data.stayType, data.tier);

  const hotel = await getPrismaClient().hotel.update({
    where: { id },
    data: {
      ...data,
      roomEntries: data.roomEntries,
      stayEntries: data.stayEntries,
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
          stayType: hotel.stayType,
          tier: hotel.tier,
          position: hotel.position
        }
      })
    )
  );
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