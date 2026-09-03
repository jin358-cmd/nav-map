import type { ParkingLot, ParkingSort } from "@/types/domain";

function feeNumber(value?: string) {
  const match = value?.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

export function sortParkingLots(lots: ParkingLot[], sort: ParkingSort) {
  return [...lots].sort((a, b) => {
    if (sort === "remaining") {
      const left = a.carAvailable ?? -1;
      const right = b.carAvailable ?? -1;
      return right - left;
    }
    if (sort === "price") {
      return feeNumber(a.fee) - feeNumber(b.fee);
    }
    return (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity);
  });
}
