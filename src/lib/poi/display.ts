import { formatChainStoreName } from "@/lib/geocoding/format-taiwan-display-address";
import {
  brandDisplayLabel,
  matchedBrand,
  normalizePoiKey,
} from "@/lib/poi/aliases";

const GENERIC_POI_NAME =
  /^(加油站|充電站|便利商店|超商|便利超商|汽機車充電站)$/u;

export function formatLayerPoiTitle(poi: {
  name?: string | null;
  brand?: string | null;
  branchName?: string | null;
  category?: string | null;
}) {
  const name = (poi.name ?? "").trim();
  const branch = (poi.branchName ?? "").trim();
  const inferred = poi.brand || matchedBrand(name)?.brand || null;
  const brand = brandDisplayLabel(inferred);
  const category = poi.category ?? "";

  if (category === "convenience" || category === "fuel") {
    if (brand && branch) return `${brand} ${branch}`;
    if (brand) {
      if (!name || GENERIC_POI_NAME.test(name)) return brand;
      const nameKey = normalizePoiKey(name);
      const brandKey = normalizePoiKey(brand);
      if (name.includes(brand) || (brandKey && nameKey.includes(brandKey))) {
        return name;
      }
      return `${brand} ${name}`;
    }
  }

  return formatChainStoreName(name, branch) || name;
}
