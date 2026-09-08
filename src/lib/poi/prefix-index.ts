import { nameFitsBrand, normalizePoiKey } from "@/lib/poi/aliases";
import { distanceKm } from "@/lib/geo";
import { encodeGeohash, nearbyGeohashes } from "@/lib/poi/geohash";
import { prefersNearby } from "@/lib/poi/intent";
import { matchTierWith, poiQueryContext, rankPois } from "@/lib/poi/rank";
import type { PoiCategory, TaiwanPoiRecord } from "@/lib/poi/schema";

export type PoiIndexes = {
  prefix: Map<string, TaiwanPoiRecord[]>;
  brand: Map<string, TaiwanPoiRecord[]>;
  category: Map<PoiCategory, TaiwanPoiRecord[]>;
  geo4: Map<string, TaiwanPoiRecord[]>;
  geo5: Map<string, TaiwanPoiRecord[]>;
};

const PREFIX_CANDIDATE_CAP = 180;
const NEARBY_MIN_POOL = 80;

function add(map: Map<string, TaiwanPoiRecord[]>, key: string, poi: TaiwanPoiRecord) {
  if (!key) return;
  const list = map.get(key);
  if (list) list.push(poi);
  else map.set(key, [poi]);
}

function prefixesOf(value: string) {
  const needle = normalizePoiKey(value);
  const keys: string[] = [];
  if (needle.length >= 1) keys.push(needle.slice(0, 1));
  if (needle.length >= 2) keys.push(needle.slice(0, 2));
  return keys;
}

export function buildPoiIndexes(rows: TaiwanPoiRecord[]): PoiIndexes {
  const prefix = new Map<string, TaiwanPoiRecord[]>();
  const brand = new Map<string, TaiwanPoiRecord[]>();
  const category = new Map<PoiCategory, TaiwanPoiRecord[]>();
  const geo4 = new Map<string, TaiwanPoiRecord[]>();
  const geo5 = new Map<string, TaiwanPoiRecord[]>();
  for (const poi of rows) {
    if (!poi.isActive) continue;
    const texts = [poi.name, poi.brand, poi.branchName, ...poi.aliases];
    for (const text of texts) {
      if (!text) continue;
      for (const key of prefixesOf(text)) add(prefix, key, poi);
    }
    if (poi.brand) add(brand, poi.brand, poi);
    const bucket = category.get(poi.category);
    if (bucket) bucket.push(poi);
    else category.set(poi.category, [poi]);
    add(geo4, encodeGeohash(poi.latitude, poi.longitude, 4), poi);
    add(geo5, encodeGeohash(poi.latitude, poi.longitude, 5), poi);
  }
  return { prefix, brand, category, geo4, geo5 };
}

function unique(rows: TaiwanPoiRecord[]) {
  const seen = new Set<string>();
  const out: TaiwanPoiRecord[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

function fromCells(
  index: Map<string, TaiwanPoiRecord[]>,
  lat: number,
  lng: number,
  precision: 4 | 5,
) {
  return unique(nearbyGeohashes(lat, lng, precision).flatMap((cell) => index.get(cell) ?? []));
}

function nearbyPool(
  indexes: PoiIndexes,
  origin: { lat: number; lng: number },
) {
  const tight = fromCells(indexes.geo5, origin.lat, origin.lng, 5);
  if (tight.length >= NEARBY_MIN_POOL) return tight;
  return fromCells(indexes.geo4, origin.lat, origin.lng, 4);
}

function nearestOfBrand(
  rows: TaiwanPoiRecord[],
  origin: { lat: number; lng: number } | undefined,
  spatialIds: Set<string> | null,
  take: number,
) {
  let pool = rows;
  if (spatialIds) {
    const near = rows.filter((row) => spatialIds.has(row.id));
    if (near.length) pool = near;
  }
  if (origin) {
    pool = [...pool].sort(
      (a, b) =>
        distanceKm(origin, { lat: a.latitude, lng: a.longitude }) -
        distanceKm(origin, { lat: b.latitude, lng: b.longitude }),
    );
  }
  return pool.slice(0, take);
}

function capNearby(
  rows: TaiwanPoiRecord[],
  spatialIds: Set<string> | null,
  cap: number,
) {
  const uniqueRows = unique(rows);
  if (!spatialIds) return diversifyByBrand(uniqueRows).slice(0, cap);
  const near: TaiwanPoiRecord[] = [];
  const far: TaiwanPoiRecord[] = [];
  for (const row of uniqueRows) {
    if (spatialIds.has(row.id)) near.push(row);
    else far.push(row);
  }
  return diversifyByBrand([...near, ...far]).slice(0, cap);
}

export function lookupIndexedPois(
  indexes: PoiIndexes,
  query: string,
  origin?: { lat: number; lng: number },
): { prefix: TaiwanPoiRecord[]; aliasBrand: TaiwanPoiRecord[]; fuzzy: TaiwanPoiRecord[] } {
  const ctx = poiQueryContext(query);
  const needle = ctx.needle;
  const prefixKey = needle.slice(0, Math.min(2, needle.length));
  const intent = ctx.intent;
  const localFirst = Boolean(origin && (prefersNearby(intent) || needle.length <= 2));
  const spatial = origin && localFirst ? nearbyPool(indexes, origin) : null;
  const spatialIds = spatial ? new Set(spatial.map((row) => row.id)) : null;

  const aliasBrand = capNearby(
    [
      ...(ctx.brandHit ? indexes.brand.get(ctx.brandHit.brand) ?? [] : []),
      ...ctx.prefixBrands.flatMap((item) => indexes.brand.get(item.brand) ?? []),
      ...(ctx.categoryHit ? indexes.category.get(ctx.categoryHit.category) ?? [] : []),
    ],
    spatialIds,
    PREFIX_CANDIDATE_CAP,
  );

  const knownShort =
    needle.length <= 2 &&
    (ctx.prefixBrands.length > 0 || Boolean(ctx.categoryHit) || Boolean(ctx.brandHit));

  if (knownShort) {
    const seeded: TaiwanPoiRecord[] = [];
    for (const item of ctx.prefixBrands) {
      seeded.push(
        ...nearestOfBrand(indexes.brand.get(item.brand) ?? [], origin, spatialIds, 2),
      );
    }
    if (ctx.categoryHit) {
      seeded.push(
        ...nearestOfBrand(
          indexes.category.get(ctx.categoryHit.category) ?? [],
          origin,
          spatialIds,
          4,
        ),
      );
    }
    return {
      prefix: [],
      aliasBrand: unique([...seeded, ...aliasBrand]).slice(0, PREFIX_CANDIDATE_CAP),
      fuzzy: [],
    };
  }

  const nearbyHits = spatial
    ? spatial.filter((row) => matchTierWith(ctx, row) !== "none")
    : [];
  const prefixSource = indexes.prefix.get(prefixKey) ?? [];
  const prefixRows = unique([
    ...nearbyHits,
    ...prefixSource.slice(0, PREFIX_CANDIDATE_CAP),
  ]).slice(0, PREFIX_CANDIDATE_CAP);

  const fuzzy = prefixRows.filter((poi) => {
    const tier = matchTierWith(ctx, poi);
    return tier === "fuzzy" || tier === "prefix" || tier === "exact" || tier === "alias";
  });

  return { prefix: prefixRows, aliasBrand, fuzzy };
}

export function searchIndexedPois(
  indexes: PoiIndexes,
  query: string,
  origin?: { lat: number; lng: number },
  limit = 24,
) {
  const ctx = poiQueryContext(query);
  const { prefix, aliasBrand, fuzzy } = lookupIndexedPois(indexes, query, origin);
  const ranked = rankPois(unique([...prefix, ...aliasBrand, ...fuzzy]), query, origin).filter(
    (poi) =>
      matchTierWith(ctx, poi) !== "none" || ctx.categoryHit?.category === poi.category,
  );
  const sevenEleven = /^\d{1,3}$/.test(ctx.needle)
    ? ctx.prefixBrands.find((item) => item.brand === "7-Eleven")
    : null;
  const cleaned = sevenEleven
    ? ranked.filter(
        (poi) => poi.brand === "7-Eleven" || nameFitsBrand(poi.name, "7-Eleven"),
      )
    : ranked;
  const mixed = ctx.needle.length <= 2 ? diversifyByBrand(cleaned) : cleaned;
  return mixed.slice(0, limit);
}

export function diversifyByBrand(rows: TaiwanPoiRecord[]) {
  const used = new Map<string, number>();
  const first: TaiwanPoiRecord[] = [];
  const rest: TaiwanPoiRecord[] = [];
  for (const row of rows) {
    const key = row.brand || row.nameNormalized.slice(0, 2);
    const count = used.get(key) ?? 0;
    if (count < 2) {
      first.push(row);
      used.set(key, count + 1);
    } else {
      rest.push(row);
    }
  }
  return [...first, ...rest];
}
