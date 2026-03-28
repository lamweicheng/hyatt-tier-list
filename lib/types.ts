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

export type TopPickRank = 1 | 2 | 3;

export type TopPickSlot = {
  rank: TopPickRank;
  hotelId: string;
  imageUrl: string;
};

export type TopSuiteSlot = {
  rank: TopPickRank;
  hotelId: string;
  suiteName: string;
  imageUrl: string;
};

export type TopFutureStaySlot = {
  rank: TopPickRank;
  hotelId: string;
  location: string;
  imageUrl: string;
};

export type TopExperienceSlot = {
  rank: TopPickRank;
  hotelId: string;
  description: string;
  imageUrl: string;
};

export type TopUnderratedSlot = {
  rank: TopPickRank;
  hotelId: string;
  imageUrl: string;
};

export type TopReturnStaySlot = {
  rank: TopPickRank;
  hotelId: string;
  imageUrl: string;
};

export type DashboardSectionId =
  | 'topHotels'
  | 'topSuites'
  | 'tierBoard'
  | 'futureHotels'
  | 'topFutureStays'
  | 'topExperiences'
  | 'topUnderrated'
  | 'topReturnStays';

export type DisplayPreferences = {
  showTopHotels: boolean;
  showTopSuites: boolean;
  showTierBoard: boolean;
  showFutureHotels: boolean;
  showTopFutureStays: boolean;
  showTopExperiences: boolean;
  showTopUnderrated: boolean;
  showTopReturnStays: boolean;
  sectionOrder: DashboardSectionId[];
};

export type DashboardPreferencesRecord = {
  topPicks: TopPickSlot[];
  topSuites: TopSuiteSlot[];
  topFutureStays: TopFutureStaySlot[];
  topExperiences: TopExperienceSlot[];
  topUnderrated: TopUnderratedSlot[];
  topReturnStays: TopReturnStaySlot[];
  displayPreferences: DisplayPreferences;
};

export type DashboardPreferencesPatch = Partial<DashboardPreferencesRecord>;
