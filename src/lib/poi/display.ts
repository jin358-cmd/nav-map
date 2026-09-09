import { formatChainStoreName } from "@/lib/geocoding/format-taiwan-display-address";
import {
  brandDisplayLabel,
  inferFuelChainBrand,
  matchedBrand,
  normalizePoiKey,
  resolveCanonicalBrand,
} from "@/lib/poi/aliases";
import { classifyEnergyKind } from "@/lib/poi/energy-kind";
import type { PoiCategory } from "@/lib/poi/schema";

const GENERIC_POI_NAME =
  /^(加油站|充電站|便利商店|超商|便利超商|汽機車充電站|飯店|旅館|民宿|hotel)$/iu;

const FUEL_TITLE_BRANDS = new Set(["中油", "台塑", "台亞", "全國", "速邁樂"]);

const FUEL_BRAND_STRIP =
  /台灣中油複合商店|中油複合商店|中油直營加油站|中油加油站|台灣中油|中國石油|中油|台塑石油|台塑石化|台塑加油站|台塑|台亞石油|台亞加油站|台亞|全國加油站|全國|統一速邁樂|速邁樂加油站|速邁樂|Smile|CPC\.?life|\bCPC\b/gi;

const FUEL_GENERIC_STRIP =
  /直營加油站|加盟加油站|加油站|加氣站|充電站|複合商店|汽柴油|石油股份有限公司|石油/g;

const GENERIC_HOTEL_BRAND = /^(hostel|hotel|b&b|b&b hôtel|旅店|旅館|飯店|民宿)$/iu;

function sameKey(left: string, right: string) {
  return Boolean(left && right && normalizePoiKey(left) === normalizePoiKey(right));
}

function extractFuelStationName(name: string, brandLabel: string) {
  const rest = name
    .replace(FUEL_BRAND_STRIP, " ")
    .replace(FUEL_GENERIC_STRIP, " ")
    .replace(/[（(][^）)]*[）)]/g, " ")
    .replace(/[－—\-_|／/,，]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!rest || sameKey(rest, brandLabel) || GENERIC_POI_NAME.test(rest)) return "";
  if (FUEL_TITLE_BRANDS.has(rest.replaceAll("臺", "台"))) return "";
  return rest;
}

function extractHotelBranch(name: string, brandLabel: string) {
  if (!brandLabel) return "";
  const brandKey = normalizePoiKey(brandLabel);
  const nameKey = normalizePoiKey(name);
  if (!brandKey || !nameKey.includes(brandKey)) return "";
  let rest = name.replaceAll("臺", "台");
  const brandLoose = brandLabel.replaceAll("臺", "台");
  rest = rest.replace(brandLoose, " ").replace(/\s+/g, " ").trim();
  rest = rest.replace(/^[－—\-_|／/\s]+|[－—\-_|／/\s]+$/g, "").trim();
  if (!rest || sameKey(rest, brandLabel) || GENERIC_POI_NAME.test(rest)) return "";
  return rest;
}

function joinBrandBranch(brand: string, branch: string) {
  if (brand && branch && !sameKey(brand, branch)) return `${brand} ${branch}`;
  return brand || branch;
}

export function formatLayerPoiTitle(poi: {
  name?: string | null;
  brand?: string | null;
  branchName?: string | null;
  category?: string | null;
}) {
  const name = (poi.name ?? "").trim();
  const taggedBranch = (poi.branchName ?? "").trim();
  const category = (poi.category ?? "") as PoiCategory | "";
  const resolved = resolveCanonicalBrand(
    poi.brand,
    name,
    category || null,
  );
  const inferred =
    resolved ||
    (GENERIC_POI_NAME.test(name) ? null : matchedBrand(name)?.brand) ||
    null;
  const brand = brandDisplayLabel(inferred);

  if (category === "fuel") {
    const energyTitle = formatEnergyStationTitle(poi);
    if (energyTitle) return energyTitle;
    const fuelBrand =
      brandDisplayLabel(inferFuelChainBrand(name, poi.brand) ?? inferred) ||
      (FUEL_TITLE_BRANDS.has(brand) ? brand : "");
    if (FUEL_TITLE_BRANDS.has(fuelBrand)) {
      const station =
        taggedBranch || extractFuelStationName(name, fuelBrand);
      return joinBrandBranch(fuelBrand, station) || fuelBrand;
    }
    if (GENERIC_POI_NAME.test(name) && brand) return brand;
  }

  if (category === "hotel") {
    const hotelBrand =
      brand && !GENERIC_HOTEL_BRAND.test(brand) ? brand : "";
    const station =
      taggedBranch || (hotelBrand ? extractHotelBranch(name, hotelBrand) : "");
    if (hotelBrand && station) return joinBrandBranch(hotelBrand, station);
    if (hotelBrand && GENERIC_POI_NAME.test(name)) return hotelBrand;
    return formatChainStoreName(name, taggedBranch) || name;
  }

  if (category === "convenience") {
    if (brand && taggedBranch) return joinBrandBranch(brand, taggedBranch);
    if (brand) {
      if (!name || GENERIC_POI_NAME.test(name)) return brand;
      const nameKey = normalizePoiKey(name);
      const brandKey = normalizePoiKey(brand);
      if (name.includes(brand) || (brandKey && nameKey.includes(brandKey))) {
        return name;
      }
      return joinBrandBranch(brand, name);
    }
  }

  return formatChainStoreName(name, taggedBranch) || name;
}

export function formatEnergyStationTitle(poi: {
  name?: string | null;
  brand?: string | null;
  branchName?: string | null;
  category?: string | null;
  subcategory?: string | null;
}) {
  const kind = classifyEnergyKind(poi);
  const name = (poi.name ?? "").trim();
  const brand = (poi.brand ?? "").trim();
  const generic = !name || GENERIC_POI_NAME.test(name);

  if (kind === "gogoro") {
    if (!generic && /gogoro|換電|電池交換|go站/i.test(name)) return name;
    if (brand && /gogoro|換電|交換/i.test(brand)) {
      return /站/.test(brand) ? brand : `${brand} 換電站`;
    }
    if (!generic) return name;
    return "Gogoro 換電站";
  }

  if (kind === "tesla") {
    if (!generic && /tesla|特斯拉|超充|supercharger/i.test(name)) return name;
    if (brand && /tesla|特斯拉|supercharger/i.test(brand)) return brand;
    if (!generic) return name;
    return "Tesla 超充站";
  }

  if (kind === "ev") {
    if (!generic) return name;
    if (brand && !GENERIC_POI_NAME.test(brand)) return brand;
    return "電車充電站";
  }

  return "";
}
