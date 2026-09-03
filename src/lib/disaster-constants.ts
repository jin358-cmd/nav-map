/** Live NCDR alert refresh. */
export const DISASTER_LIVE_CACHE_MS = 5 * 60 * 1000;
export const DISASTER_FETCH_TIMEOUT_MS = 12_000;
export const DISASTER_NEARBY_KM = 8;
export const DISASTER_MAP_CAP = 24;

export const NCDR_PUBLIC_JSON_FEED =
  "https://alerts.ncdr.nat.gov.tw/JSONAtomFeed.ashx";
export const NCDR_MEMBER_JSON_FEED =
  "https://alerts.ncdr.nat.gov.tw/webapi/JsonAtomFeed.ashx";

export const NCDR_USER_AGENT = "navpilot/0.1 (ncdr disaster alerts)";
