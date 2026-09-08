export const ENERGY_KINDS = ["petrol", "gogoro", "ev"] as const;

export type EnergyKind = (typeof ENERGY_KINDS)[number];

const GOGORO_RE =
  /gogoro|go\s*station|gostation|go站|換電|電池交換|電池交換站/i;
const EV_STRONG_RE =
  /充電樁|tesla|supercharger|特斯拉|u-?power|ionity|電車充電|汽車充電|ev\s*charger|charging station/i;
const EV_STATION_RE = /充電站/;
const NOT_EV_RE = /手機充電|行動電源|電動車超市|電動車專賣/;

export type EnergyStationFields = {
  name?: string | null;
  brand?: string | null;
  category?: string | null;
  subcategory?: string | null;
};

function haystack(poi: EnergyStationFields) {
  return `${poi.name ?? ""} ${poi.brand ?? ""} ${poi.subcategory ?? ""}`;
}

export function isEnergyKind(value: string | null | undefined): value is EnergyKind {
  return Boolean(value && ENERGY_KINDS.includes(value as EnergyKind));
}

export function classifyEnergyKind(poi: EnergyStationFields): EnergyKind | null {
  const text = haystack(poi);
  if (GOGORO_RE.test(text)) return "gogoro";
  if (!NOT_EV_RE.test(text)) {
    if (
      poi.subcategory === "charging" ||
      EV_STRONG_RE.test(text) ||
      EV_STATION_RE.test(text) ||
      (/快充|慢充/.test(text) && /充/.test(text))
    ) {
      return "ev";
    }
  }
  if (poi.category === "fuel") return "petrol";
  return null;
}

export function matchesEnergyKind(poi: EnergyStationFields, kind: EnergyKind) {
  return classifyEnergyKind(poi) === kind;
}
