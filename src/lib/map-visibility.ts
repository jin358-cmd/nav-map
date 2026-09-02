import { isPointInBounds } from "@/lib/geo";
import type { LngLat, MapViewport } from "@/types/domain";

export type ZoomCountBand = {
  /** Zoomed-out floor (city / district). */
  out: number;
  /** Zoomed-in ceiling (street / intersection). */
  inn: number;
  minZoom?: number;
  maxZoom?: number;
};

export const CCTV_ZOOM_COUNT: ZoomCountBand = {
  out: 4,
  inn: 22,
  minZoom: 11.5,
  maxZoom: 18.8,
};

export const ACCIDENT_ZOOM_COUNT: ZoomCountBand = {
  out: 2,
  inn: 10,
  minZoom: 11.5,
  maxZoom: 18.5,
};

export const DISASTER_ZOOM_COUNT: ZoomCountBand = {
  out: 2,
  inn: 12,
  minZoom: 11.5,
  maxZoom: 18.5,
};

/** More markers as the map zooms in; fewer when the frame covers a whole district. */
export function zoomVisibleLimit(zoom: number, band: ZoomCountBand): number {
  const z0 = band.minZoom ?? 11.5;
  const z1 = band.maxZoom ?? 18.5;
  const t = Math.max(0, Math.min(1, (zoom - z0) / (z1 - z0)));
  return Math.max(1, Math.round(band.out + t * (band.inn - band.out)));
}

export function padBounds(
  bounds: MapViewport["bounds"],
  padRatio = 0.06,
): MapViewport["bounds"] {
  const lngPad = (bounds.east - bounds.west) * padRatio;
  const latPad = (bounds.north - bounds.south) * padRatio;
  return {
    west: bounds.west - lngPad,
    east: bounds.east + lngPad,
    south: bounds.south - latPad,
    north: bounds.north + latPad,
  };
}

export function pickVisiblePoints<T>(
  items: T[],
  {
    location,
    viewport,
    limit,
    prefer,
  }: {
    location: (item: T) => LngLat;
    viewport: MapViewport | null;
    limit: number;
    prefer?: (item: T) => boolean;
  },
): T[] {
  const inView = viewport
    ? items.filter((item) =>
        isPointInBounds(location(item), padBounds(viewport.bounds)),
      )
    : items;

  const pool = inView.length ? inView : items;
  if (!prefer) return pool.slice(0, limit);

  const preferred = pool.filter(prefer);
  const rest = pool.filter((item) => !preferred.includes(item));
  return [...preferred, ...rest].slice(0, limit);
}

export function pinSelected<T extends { id: string }>(
  visible: T[],
  selectedId: string | null,
  catalog: T[],
): T[] {
  if (!selectedId) return visible;
  if (visible.some((item) => item.id === selectedId)) return visible;
  const selected = catalog.find((item) => item.id === selectedId);
  return selected ? [selected, ...visible] : visible;
}
