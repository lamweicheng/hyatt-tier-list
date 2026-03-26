export type Tier = 'S' | 'A' | 'B' | 'C' | 'D';

export type StayType = 'EXPLORED' | 'FUTURE';

export type RoomEntryKind = 'ROOM' | 'SUITE';

export type RoomEntry = {
  label: string;
  kind: RoomEntryKind;
};

export type HyattBrand = {
  name: string;
  color: string;
  segment: string;
};

export type HotelDraft = {
  name: string;
  brand: string;
  stayType: StayType;
  tier: Tier | null;
  roomEntries: RoomEntry[];
};

export type HotelRecord = HotelDraft & {
  id: string;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type PersistenceMode = 'database' | 'local';
