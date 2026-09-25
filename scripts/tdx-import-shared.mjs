import crypto from "node:crypto";

export const SOUTH_REGIONS = [
  ["YunlinCounty", "雲林縣"],
  ["ChiayiCounty", "嘉義縣"],
  ["Chiayi", "嘉義市"],
  ["Tainan", "臺南市"],
  ["Kaohsiung", "高雄市"],
  ["PingtungCounty", "屏東縣"],
];

export const TAIWAN_BOUNDS = {
  minLat: 21.7,
  maxLat: 26.5,
  minLng: 118,
  maxLng: 122.2,
};

export function text(value) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    return text(value.Zh_tw) || text(value.En) || text(value.Zh_cn);
  }
  return "";
}

export function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function pointOf(row) {
  const position = row.CarParkPosition || row.Position || {};
  return {
    lat: number(position.PositionLat ?? row.Latitude ?? row.lat),
    lng: number(position.PositionLon ?? row.Longitude ?? row.lng),
  };
}

export function sourceIdOf(row) {
  return text(row.CarParkID ?? row.ParkingLotID ?? row.ID ?? row.Id);
}

export function validateParkingRow(row) {
  const errors = [];
  const sourceId = sourceIdOf(row);
  const point = pointOf(row);
  if (!sourceId) errors.push("missing_source_id");
  if (!text(row.CarParkName ?? row.Name)) errors.push("missing_name");
  const coordinateValid = point.lat !== null && point.lng !== null;
  if (!coordinateValid) errors.push("invalid_coordinate");
  const withinTaiwan =
    coordinateValid &&
    point.lat >= TAIWAN_BOUNDS.minLat &&
    point.lat <= TAIWAN_BOUNDS.maxLat &&
    point.lng >= TAIWAN_BOUNDS.minLng &&
    point.lng <= TAIWAN_BOUNDS.maxLng;
  if (coordinateValid && !withinTaiwan) errors.push("outside_taiwan");
  return { sourceId, point, coordinateValid, withinTaiwan, errors };
}

export function normalizeParkingRow(row, context) {
  const checked = validateParkingRow(row);
  const now = context.fetchedAt;
  const sourceUpdatedAt =
    text(row.UpdateTime ?? row.DataCollectTime ?? row.SrcUpdateTime) || null;
  return {
    source: "tdx",
    source_id: checked.sourceId || `invalid-${crypto.randomUUID()}`,
    dataset: "parking_offstreet_carpark",
    region: context.region,
    city: text(row.City) || context.city,
    district: text(row.TownName ?? row.District),
    source_url: `https://tdx.transportdata.tw/api/basic/v1/Parking/OffStreet/CarPark/City/${context.region}`,
    source_updated_at: sourceUpdatedAt,
    fetched_at: now,
    normalized_at: now,
    data_version: context.sourceVersion,
    raw_metadata: row,
    normalized_data: {
      name: text(row.CarParkName ?? row.Name),
      address: text(row.Address),
      latitude: checked.point.lat,
      longitude: checked.point.lng,
      total_spaces: number(row.TotalSpaces),
      operating_hours: text(row.ServiceTime ?? row.BusinessHours),
      rate_description: text(row.FareDescription ?? row.Description),
      source_updated_at: sourceUpdatedAt,
    },
    coordinate_valid: checked.coordinateValid,
    within_taiwan: checked.withinTaiwan,
    validation_errors: checked.errors,
    normalization_status: checked.errors.length ? "rejected" : "accepted",
  };
}

export function deduplicate(rows) {
  const seen = new Set();
  let duplicates = 0;
  const records = [];
  for (const row of rows) {
    const key = `${row.source}:${row.dataset}:${row.region}:${row.source_id}`;
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    records.push(row);
  }
  return { records, duplicates };
}
