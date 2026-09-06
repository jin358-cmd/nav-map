import type {
  ParkingAvailabilityStatus,
  ParkingFeeClass,
  ParkingFill,
} from "@/types/domain";

export type ParkingVehicleType = "car" | "motorcycle" | "other";
export type ParkingRateType = "hourly" | "daily" | "free" | "unknown";

export type NormalizedParkingLot = {
  id: string;
  source: string;
  sourceParkingId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  totalSpaces: number | null;
  carSpaces: number | null;
  motorcycleSpaces: number | null;
  disabledSpaces: number | null;
  operatingHours: string;
  phone: string;
  operator: string;
  city: string;
  district: string;
  isActive: boolean;
  publicLot: boolean;
  registered: boolean;
  feeClass: ParkingFeeClass;
  availability: {
    availableSpaces: number | null;
    totalSpaces: number | null;
    occupancyRate: number | null;
    dataTimestamp: string | null;
    status: ParkingAvailabilityStatus;
  };
  rate: {
    vehicleType: ParkingVehicleType;
    rateType: ParkingRateType;
    hourlyRate: number | null;
    dailyMax: number | null;
    description: string;
  };
};

export type ParkingSyncResult = {
  source: string;
  startedAt: string;
  completedAt: string;
  fetchedRecords: number;
  insertedRecords: number;
  updatedRecords: number;
  failedRecords: number;
  supabaseWrites: number;
  status: "success" | "partial" | "failed";
  errorMessage: string | null;
  lots: NormalizedParkingLot[];
};

export function parkingFillFromAvailability(
  available: number | null,
  total: number | null,
  status: ParkingAvailabilityStatus,
): ParkingFill {
  if (status === "unknown" || status === "stale" || available == null) {
    return "unknown";
  }
  if (status === "full" || available <= 0) return "full";
  if (total && total > 0 && available / total <= 0.15) return "limited";
  if (available <= 8) return "limited";
  return "plenty";
}
