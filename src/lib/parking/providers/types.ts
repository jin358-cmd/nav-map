import type { NormalizedParkingLot } from "@/lib/parking/schema";
import type { LngLat } from "@/types/domain";

export type ParkingProviderQuery = {
  center?: LngLat;
  radiusMeters?: number;
};

export type ParkingProvider = {
  source: string;
  city: string;
  fetchNormalized(query?: ParkingProviderQuery): Promise<NormalizedParkingLot[]>;
};
