export const PARKING_CHAIN_BRANDS = [
  { id: "times", label: "嘟嘟房", pattern: /嘟嘟房|times\s*parking|\btimes\b/i },
  { id: "taiwan-parking", label: "台灣聯通", pattern: /台灣聯通|臺灣聯通|聯通停車/ },
  { id: "carplus", label: "格上", pattern: /格上停車|格上租車|\bcar-?plus\b/i },
  { id: "citypark", label: "城市車旅", pattern: /城市車旅|city\s*park|focus停車場/i },
  { id: "hongsui", label: "竑穗", pattern: /竑穗/ },
  { id: "park-easy", label: "停簡單", pattern: /停簡單|parkeasy/i },
  { id: "iparking", label: "俥酷", pattern: /俥酷|iparking/i },
  { id: "upark", label: "優停車", pattern: /優停車|\bu-?park\b/i },
  { id: "risheng", label: "日盛", pattern: /日盛停車|日盛/ },
  { id: "fuji", label: "福吉", pattern: /福吉停車|^福吉/ },
] as const;

export function matchParkingBrand(...parts: Array<string | null | undefined>) {
  const blob = parts.filter(Boolean).join(" ");
  if (!blob) return null;
  for (const brand of PARKING_CHAIN_BRANDS) {
    if (brand.pattern.test(blob)) return brand.label;
  }
  return null;
}

export function inferPublicLot(input: {
  isPublic?: unknown;
  operationType?: unknown;
  typeName?: string;
  name?: string;
  operator?: string;
  brand?: string | null;
}) {
  const typeName = input.typeName ?? "";
  const blob = `${typeName} ${input.name ?? ""} ${input.operator ?? ""}`;
  if (/民營/.test(typeName) || /私有民營/.test(blob)) return false;
  const isPublic = Number(input.isPublic);
  if (isPublic === 1) return true;
  if (isPublic === 0) return false;
  const operationType = Number(input.operationType);
  if (operationType === 3) return false;
  if (operationType === 1 || operationType === 2) return true;
  if (
    /公有|公營|智慧停車|市立|縣立|鄉立|鎮立|停管處|交通局|本處自營|市屬機關/.test(
      blob,
    )
  ) {
    return true;
  }
  if (input.brand) return false;
  return false;
}

export function parkingOwnershipLabel(publicLot: boolean) {
  return publicLot ? "公有" : "民營";
}
