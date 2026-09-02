/** City live traffic search / draw limits. Freeway types are reserved. */
export const CITY_TRAFFIC_NEARBY_KM = 8;
/** HUD「5km」開關：只畫車輛附近與路線沿線路況 */
export const CITY_TRAFFIC_FOCUS_KM = 5;
export const CITY_TRAFFIC_PRIORITY_KM = 1;
export const CITY_TRAFFIC_ROUTE_BUFFER_KM = 0.4;
export const CITY_TRAFFIC_MAP_CAP = 40;
export const CITY_TRAFFIC_MOVE_REFRESH_KM = 0.35;
export const CITY_TRAFFIC_ZOOM_REFRESH_DELTA = 0.55;

/** Live TravelSpeed / CongestionLevel refresh. */
export const TRAFFIC_LIVE_CACHE_MS = 60 * 1000;
/** Section metadata + WKT shapes change slowly. */
export const TRAFFIC_SHAPE_CACHE_MS = 15 * 60 * 1000;

export const TRAFFIC_SOURCE_ID = "traffic-source";
export const TRAFFIC_LAYER_ID = "traffic-layer";

/** Legacy Phase 1/2 source ids — removed on upsert. */
export const LEGACY_TRAFFIC_SOURCE_ID = "mock-traffic";
export const LEGACY_TRAFFIC_LAYER_ID = "mock-traffic-line";

export const TDX_TOKEN_URL =
  "https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token";
export const TDX_API_BASE = "https://tdx.transportdata.tw/api/basic";
export const TDX_TAINAN_CITY = "Tainan";
export const TDX_PAGE_SIZE = 3000;
