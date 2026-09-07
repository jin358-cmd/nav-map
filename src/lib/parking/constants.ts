export const TAINAN_PARKWEB_URL =
  "https://parkweb.tainan.gov.tw/api/parking.php?mode=0";
export const TAINAN_PARKING_SOURCE = "tainan-parkweb";
export const TDX_PARKING_SOURCE = "tdx-offstreet";
export const TAIPEI_PARKING_SOURCE = "taipei-pma";
export const OSM_PARKING_SOURCE = "osm-parking";
export const TAIPEI_PARK_DESC_URL =
  "https://tcgbusfs.blob.core.windows.net/blobtcmsv/TCMSV_alldesc.json";
export const TAIPEI_PARK_AVAIL_URL =
  "https://tcgbusfs.blob.core.windows.net/blobtcmsv/TCMSV_allavailable.json";
export const OSM_OVERPASS_URL = "https://overpass-api.de/api/interpreter";
export const PARKING_STALE_AFTER_MS = 10 * 60 * 1000;
export const PARKING_AVAIL_SYNC_MS = 3 * 60 * 1000;
/** Occupancy refresh while the nearby parking panel is open. */
export const PARKING_PANEL_REFRESH_MS = 10 * 1000;
export const PARKING_LOT_SYNC_MS = 24 * 60 * 60 * 1000;
export const PARKING_DEFAULT_RADIUS_M = 1000;
export const PARKING_CURRENT_LOCATION_RADIUS_M = 3000;
export const PARKING_DESTINATION_RADIUS_M = 1000;
export const PARKING_MIN_RADIUS_M = 200;
export const PARKING_MAX_RADIUS_M = 5000;
export const PARKING_USER_AGENT =
  "NavPilot/0.1 (https://github.com/jin358-cmd/nav-map)";
