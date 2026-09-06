import type { ParkingFeeClass } from "@/types/domain";

const FREE_FARE = /免費|不收費|免收費|免收|免費停車|\bfree\b/i;
const PAID_FARE = /\d+\s*元|計時|計次|小時|半小時|月租|收費|\bpaid\b/i;

export const PARKING_FEE_LABEL = {
  paid: "收費",
  free: "無收費",
  unknown: "收費未提供",
} as const;

export function parkingFeeLayerColor(feeClass: ParkingFeeClass) {
  if (feeClass === "free") return "#22c55e";
  if (feeClass === "paid") return "#f59e0b";
  return "#64748b";
}

export function parkingLayerLabel(
  feeClass: ParkingFeeClass,
  carAvailable?: number | null,
) {
  const count =
    carAvailable == null ? "" : String(Math.max(0, carAvailable));
  if (feeClass === "free") return `免${count}`;
  if (feeClass === "paid") return `收${count}`;
  return `P${carAvailable == null ? "?" : count}`;
}

export function classifyParkingFee(
  fare?: string,
  chargeTypes: number[] = [],
): ParkingFeeClass {
  const types = new Set(chargeTypes.filter((value) => Number.isFinite(value)));
  const billed = [1, 2, 3].some((code) => types.has(code));
  if (types.has(4) && !billed) return "free";
  if (billed) return "paid";

  const text = fare?.replace(/\s+/g, "") ?? "";
  if (!text) return "unknown";
  if (FREE_FARE.test(text) && !/\d+元/.test(text)) return "free";
  if (PAID_FARE.test(text)) return "paid";
  return "unknown";
}

export function chargeTypesOf(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "number" && Number.isFinite(item)) return [item];
    if (typeof item === "string" && Number.isFinite(Number(item))) {
      return [Number(item)];
    }
    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      const parsed = Number(record.ChargeType ?? record.Type ?? record.value);
      return Number.isFinite(parsed) ? [parsed] : [];
    }
    return [];
  });
}

export function flagOf(value: unknown): number | null {
  if (value === true || value === "1" || value === 1) return 1;
  if (value === false || value === "0" || value === 0) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function isPublicParkingLot(row: {
  isPublic?: unknown;
  operationType?: unknown;
  name?: string;
}): boolean {
  const isPublic = flagOf(row.isPublic);
  const operationType = flagOf(row.operationType);
  if (isPublic === 1) return true;
  if (isPublic === 0) return false;
  if (operationType === 1 || operationType === 2) return true;
  if (operationType === 3) return false;
  return /公有|公營|市立|縣立|鄉立|鎮立|停管處|交通局/.test(row.name ?? "");
}
