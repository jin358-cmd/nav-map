/**
 * Inverse transverse Mercator for TWD97 / TM2.
 * EPSG:3826 is zone 121 (false easting 250000, k0 0.9999, GRS80).
 * TWD97 differs from WGS84 by about a metre, which is enough for road events.
 */
export function twd97Tm2ToWgs84(
  easting: number,
  northing: number,
  centralMeridian = 121,
): [number, number] | null {
  if (!Number.isFinite(easting) || !Number.isFinite(northing)) return null;
  const a = 6378137.0;
  const f = 1 / 298.257222101;
  const k0 = 0.9999;
  const falseEasting = 250000;
  const lon0 = (centralMeridian * Math.PI) / 180;
  const b = a * (1 - f);
  const e2 = (a * a - b * b) / (a * a);
  const ep2 = (a * a - b * b) / (b * b);
  const x = easting - falseEasting;
  const y = northing;
  const M = y / k0;
  const mu =
    M /
    (a *
      (1 -
        e2 / 4 -
        (3 * e2 * e2) / 64 -
        (5 * e2 * e2 * e2) / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 * e1) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const sinPhi = Math.sin(phi1);
  const cosPhi = Math.cos(phi1);
  if (Math.abs(cosPhi) < 1e-12) return null;
  const tanPhi = Math.tan(phi1);
  const C1 = ep2 * cosPhi * cosPhi;
  const T1 = tanPhi * tanPhi;
  const N1 = a / Math.sqrt(1 - e2 * sinPhi * sinPhi);
  const R1 = (a * (1 - e2)) / (1 - e2 * sinPhi * sinPhi) ** 1.5;
  const D = x / (N1 * k0);
  const lat =
    phi1 -
    ((N1 * tanPhi) / R1) *
      (D * D / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) *
          D ** 6) /
          720);
  const lon =
    lon0 +
    (D -
      ((1 + 2 * T1 + C1) * D ** 3) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5) /
        120) /
      cosPhi;
  return [(lon * 180) / Math.PI, (lat * 180) / Math.PI];
}
