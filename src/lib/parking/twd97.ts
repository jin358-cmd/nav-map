/** TWD97 TM2 121 (EPSG:3826) → WGS84. Used by Taipei parking Open Data. */
export function twd97ToWgs84(easting: number, northing: number) {
  const a = 6378137.0;
  const b = 6356752.314245;
  const lng0 = (121 * Math.PI) / 180;
  const k0 = 0.9999;
  const dx = 250000;
  const x = easting - dx;
  const y = northing;
  const e = Math.sqrt(1 - (b * b) / (a * a));
  const m = y / k0;
  const mu =
    m /
    (a *
      (1 -
        Math.pow(e, 2) / 4 -
        (3 * Math.pow(e, 4)) / 64 -
        (5 * Math.pow(e, 6)) / 256));
  const e1 = (1 - Math.sqrt(1 - e * e)) / (1 + Math.sqrt(1 - e * e));
  const j1 = (3 * e1) / 2 - (27 * Math.pow(e1, 3)) / 32;
  const j2 = (21 * Math.pow(e1, 2)) / 16 - (55 * Math.pow(e1, 4)) / 32;
  const j3 = (151 * Math.pow(e1, 3)) / 96;
  const j4 = (1097 * Math.pow(e1, 4)) / 512;
  const fp =
    mu +
    j1 * Math.sin(2 * mu) +
    j2 * Math.sin(4 * mu) +
    j3 * Math.sin(6 * mu) +
    j4 * Math.sin(8 * mu);
  const e2 = Math.pow((e * a) / b, 2);
  const c1 = e2 * Math.pow(Math.cos(fp), 2);
  const t1 = Math.pow(Math.tan(fp), 2);
  const r1 = (a * (1 - e * e)) / Math.pow(1 - Math.pow(e * Math.sin(fp), 2), 1.5);
  const n1 = a / Math.sqrt(1 - Math.pow(e * Math.sin(fp), 2));
  const d = x / (n1 * k0);
  const q1 = (n1 * Math.tan(fp)) / r1;
  const lat =
    fp -
    q1 *
      (Math.pow(d, 2) / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * e2) * Math.pow(d, 4)) / 24 +
        ((61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * e2 - 3 * c1 * c1) *
          Math.pow(d, 6)) /
          720);
  const lng =
    lng0 +
    (d -
      ((1 + 2 * t1 + c1) * Math.pow(d, 3)) / 6 +
      ((5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * e2 + 24 * t1 * t1) *
        Math.pow(d, 5)) /
        120) /
      Math.cos(fp);
  return {
    lat: (lat * 180) / Math.PI,
    lng: (lng * 180) / Math.PI,
  };
}
