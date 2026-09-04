import type {
  AddressDataRecord,
  AddressImportStats,
} from "@/lib/address-data/schema";

export type AddressAdapterInput = {
  county: string;
  raw: Record<string, unknown>;
  source: string;
  license: string;
  importedAt: string;
};

export type AddressAdapter = {
  name: string;
  normalize(input: AddressAdapterInput): AddressDataRecord | null;
};

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function finite(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function recordId(source: string, sourceRecordId: string | null, address: string) {
  return `${source}:${sourceRecordId ?? address}`;
}

export const officialRoadNameAdapter: AddressAdapter = {
  name: "official-road-name",
  normalize(input) {
    const road = text(input.raw.road) ?? text(input.raw.roadName);
    const county = text(input.raw.county) ?? input.county;
    if (!road) return null;
    const normalizedAddress = `${county}${text(input.raw.district) ?? ""}${road}${text(input.raw.section) ?? ""}`;
    return {
      id: recordId(input.source, text(input.raw.id), normalizedAddress),
      countryCode: "TW",
      county,
      district: text(input.raw.district),
      village: text(input.raw.village),
      neighborhood: text(input.raw.neighborhood),
      road,
      section: text(input.raw.section),
      lane: null,
      alley: null,
      houseNumber: null,
      normalizedAddress,
      displayAddress: normalizedAddress,
      latitude: finite(input.raw.latitude ?? input.raw.lat),
      longitude: finite(input.raw.longitude ?? input.raw.lng),
      accuracy: "road-center",
      source: input.source,
      sourceRecordId: text(input.raw.id) ?? undefined,
      importedAt: input.importedAt,
      license: input.license,
      coordinateSystem: "EPSG:4326",
    };
  },
};

export const officialDoorplateAdapter: AddressAdapter = {
  name: "official-doorplate",
  normalize(input) {
    const houseNumber = text(input.raw.houseNumber) ?? text(input.raw.number);
    const road = text(input.raw.road);
    const county = text(input.raw.county) ?? input.county;
    if (!road && !houseNumber) return null;
    const normalizedAddress = [
      county,
      text(input.raw.district),
      road,
      text(input.raw.section),
      text(input.raw.lane),
      text(input.raw.alley),
      houseNumber,
    ]
      .filter(Boolean)
      .join("");
    const latitude = finite(input.raw.latitude ?? input.raw.lat);
    const longitude = finite(input.raw.longitude ?? input.raw.lng);
    return {
      id: recordId(input.source, text(input.raw.id), normalizedAddress),
      countryCode: "TW",
      county,
      district: text(input.raw.district),
      village: text(input.raw.village),
      neighborhood: text(input.raw.neighborhood),
      road,
      section: text(input.raw.section),
      lane: text(input.raw.lane),
      alley: text(input.raw.alley),
      houseNumber,
      normalizedAddress,
      displayAddress: normalizedAddress,
      latitude,
      longitude,
      accuracy: latitude != null && longitude != null && houseNumber
        ? "exact-house"
        : houseNumber
          ? "approximate"
          : "road-center",
      source: input.source,
      sourceRecordId: text(input.raw.id) ?? undefined,
      importedAt: input.importedAt,
      license: input.license,
      coordinateSystem: "EPSG:4326",
    };
  },
};

export const overturePlaceAdapter: AddressAdapter = {
  name: "overture-place",
  normalize(input) {
    const name = text(input.raw.name) ?? text(input.raw.primaryName);
    const latitude = finite(input.raw.latitude ?? input.raw.lat);
    const longitude = finite(input.raw.longitude ?? input.raw.lng);
    if (!name || latitude == null || longitude == null) return null;
    return {
      id: recordId(input.source, text(input.raw.id), name),
      countryCode: "TW",
      county: text(input.raw.county) ?? input.county,
      district: text(input.raw.district),
      village: null,
      neighborhood: null,
      road: text(input.raw.road),
      section: null,
      lane: null,
      alley: null,
      houseNumber: null,
      normalizedAddress: name,
      displayAddress: name,
      latitude,
      longitude,
      accuracy: "landmark",
      source: input.source,
      sourceRecordId: text(input.raw.id) ?? undefined,
      importedAt: input.importedAt,
      license: input.license,
      coordinateSystem: "EPSG:4326",
    };
  },
};

export function emptyStats(
  county: string,
  datasetName: string,
  source: string,
  license: string,
): AddressImportStats {
  return {
    county,
    datasetName,
    source,
    license,
    total: 0,
    withCoordinates: 0,
    withoutCoordinates: 0,
    duplicates: 0,
    failed: 0,
    updatedAt: new Date().toISOString(),
  };
}
