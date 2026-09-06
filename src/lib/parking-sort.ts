import type { ParkingFeeClass, ParkingLot, ParkingSort } from "@/types/domain";

function feeNumber(value?: string) {
  const match = value?.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function feeRank(value: ParkingFeeClass) {
  if (value === "free") return 0;
  if (value === "paid") return 1;
  return 2;
}

export function sortParkingLots(lots: ParkingLot[], sort: ParkingSort) {
  return [...lots].sort((a, b) => {
    if (sort === "remaining") {
      const left = a.carAvailable ?? -1;
      const right = b.carAvailable ?? -1;
      return right - left;
    }
    if (sort === "price") {
      const classDelta = feeRank(a.feeClass) - feeRank(b.feeClass);
      if (classDelta !== 0) return classDelta;
      const left = a.hourlyRate ?? feeNumber(a.fee);
      const right = b.hourlyRate ?? feeNumber(b.fee);
      return left - right;
    }
    return (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity);
  });
}
