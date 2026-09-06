import { poiCategoryLabel } from "@/lib/poi/category-label";
import type { PoiCategory } from "@/lib/poi/schema";
import type {
  GeocodeHit,
  LngLat,
  ParkingFeeClass,
  ParkingLot,
} from "@/types/domain";

export type MapPlaceKind = "poi" | "parking" | "custom";

export type MapPlace = {
  id: string;
  kind: MapPlaceKind;
  name: string;
  category?: string;
  categoryLabel?: string;
  address: string;
  location: LngLat;
  distanceMeters?: number;
  source?: string;
  phone?: string;
  hours?: string;
  openStatus?: string;
  carAvailable?: number | null;
  carTotal?: number | null;
  fee?: string;
  feeClass?: ParkingFeeClass;
  hourlyRate?: number | null;
  dailyMax?: number | null;
  registered?: boolean;
  publicLot?: boolean;
  brand?: string | null;
  updatedAt?: string;
  availabilityStatus?: ParkingLot["availabilityStatus"];
};

export type MapPoiFeature = {
  id: string;
  name: string;
  category: PoiCategory;
  brand: string | null;
  address: string;
  location: LngLat;
  source: string;
  updatedAt: string;
};

export function mapPlaceToHit(place: MapPlace): GeocodeHit {
  return {
    id: place.id,
    name: place.name,
    address: place.address,
    location: place.location,
    source: place.kind === "custom" ? "local" : "index",
    matchKind: place.kind === "custom" ? "approximate" : "landmark",
    distanceMeters: place.distanceMeters,
    category: place.category,
    phone: place.phone,
    hours: place.hours,
  };
}

export function poiFeatureToPlace(
  feature: MapPoiFeature,
  origin?: LngLat | null,
): MapPlace {
  return {
    id: feature.id,
    kind: "poi",
    name: feature.name,
    category: feature.category,
    categoryLabel: poiCategoryLabel(feature.category),
    address: feature.address,
    location: feature.location,
    source: feature.source,
    distanceMeters: origin
      ? Math.round(
          Math.hypot(
            (feature.location.lng - origin.lng) * 111000 * Math.cos((origin.lat * Math.PI) / 180),
            (feature.location.lat - origin.lat) * 111000,
          ),
        )
      : undefined,
  };
}

export function parkingLotToPlace(lot: ParkingLot): MapPlace {
  return {
    id: `parking-${lot.id}`,
    kind: "parking",
    name: lot.name,
    category: "parking",
    categoryLabel: "停車場",
    address: lot.address ?? "",
    location: lot.location,
    distanceMeters: lot.distanceMeters,
    source: lot.source,
    hours: lot.hours,
    fee: lot.fee,
    feeClass: lot.feeClass,
    hourlyRate: lot.hourlyRate,
    dailyMax: lot.dailyMax,
    registered: lot.registered,
    publicLot: lot.publicLot,
    brand: lot.brand,
    updatedAt: lot.updatedAt,
    availabilityStatus: lot.availabilityStatus,
    carAvailable: lot.carAvailable,
    carTotal: lot.carTotal,
    openStatus:
      lot.fill === "full"
        ? "車位已滿"
        : lot.fill === "plenty"
          ? "車位充足"
          : lot.fill === "limited"
            ? "剩餘不多"
            : undefined,
  };
}

export function customPlaceFromLngLat(location: LngLat): MapPlace {
  return {
    id: `custom-${location.lng.toFixed(5)}-${location.lat.toFixed(5)}`,
    kind: "custom",
    name: "自訂位置",
    categoryLabel: "自訂位置",
    address: `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`,
    location,
    source: "local",
  };
}
