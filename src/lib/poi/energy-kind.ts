export const ENERGY_KINDS = ["petrol", "gogoro", "tesla", "ev"] as const;

export type EnergyKind = (typeof ENERGY_KINDS)[number];

const GOGORO_RE =
  /gogoro|go\s*station|gostation|go站|換電|電池交換|電池交換站/i;
const TESLA_NAME_RE = /tesla|特斯拉/i;
const TESLA_CHARGE_RE = /supercharger|超充|充電|charging/i;
const EV_STRONG_RE =
  /充電樁|u-?power|ionity|電車充電|汽車充電|ev\s*charger|charging station/i;
const EV_STATION_RE = /充電站/;
const NOT_EV_RE = /手機充電|行動電源|電動車超市|電動車專賣/;
const GOGORO_STATION_RE = /換電|電池交換|gostation|go\s*station|go站/i;

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

function isTeslaSupercharger(text: string) {
  if (TESLA_NAME_RE.test(text) && TESLA_CHARGE_RE.test(text)) return true;
  return /supercharger/i.test(text);
}

export function classifyEnergyKind(poi: EnergyStationFields): EnergyKind | null {
  const text = haystack(poi);
  if (GOGORO_RE.test(text)) {
    if (
      poi.category === "fuel" ||
      poi.subcategory === "fuel" ||
      poi.subcategory === "charging" ||
      GOGORO_STATION_RE.test(text)
    ) {
      return "gogoro";
    }
    return null;
  }
  if (isTeslaSupercharger(text)) return "tesla";
  if (!NOT_EV_RE.test(text)) {
    if (
      poi.subcategory === "charging" ||
      EV_STRONG_RE.test(text) ||
      EV_STATION_RE.test(text) ||
      /快充|慢充/.test(text)
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
