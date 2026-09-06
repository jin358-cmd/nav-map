import type { NormalizedParkingLot } from "@/lib/parking/schema";

export type ParkingProvider = {
  source: string;
  city: string;
  fetchNormalized(): Promise<NormalizedParkingLot[]>;
};
