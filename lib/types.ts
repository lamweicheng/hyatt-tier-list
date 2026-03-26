export type Tier = 'S' | 'A' | 'B' | 'C' | 'D';

export type HyattBrand = {
  name: string;
  color: string;
  segment: string;
};

export type HotelDraft = {
  name: string;
  brand: string;
  tier: Tier;
};

export type HotelRecord = HotelDraft & {
  id: string;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type PersistenceMode = 'database' | 'local';
