const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

/** ~20–40 km cells; nearby suggest cache must not cross this region. */
export const SUGGEST_GEOHASH_PRECISION = 4;

export function encodeGeohash(
  lat: number,
  lng: number,
  precision = SUGGEST_GEOHASH_PRECISION,
) {
  let minLat = -90;
  let maxLat = 90;
  let minLng = -180;
  let maxLng = 180;
  let hash = "";
  let bit = 0;
  let ch = 0;
  let even = true;
  while (hash.length < precision) {
    if (even) {
      const mid = (minLng + maxLng) / 2;
      if (lng >= mid) {
        ch |= 1 << (4 - bit);
        minLng = mid;
      } else {
        maxLng = mid;
      }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) {
        ch |= 1 << (4 - bit);
        minLat = mid;
      } else {
        maxLat = mid;
      }
    }
    even = !even;
    if (bit < 4) bit += 1;
    else {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}
