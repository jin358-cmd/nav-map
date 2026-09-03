import "server-only";

import type { LngLat } from "@/types/domain";

const TGOS_ENDPOINT =
  process.env.TGOS_API_URL?.trim() ||
  "https://addr.tgos.tw/addrws/v30/QueryAddr.asmx/QueryAddr";
const NLSC_LAND_ENDPOINT =
  "https://api.nlsc.gov.tw/other/TownVillagePointQuery";
const NLSC_MAP_SEARCH =
  process.env.NLSC_API_URL?.trim() ||
  "https://api.nlsc.gov.tw/idc/TextQueryMap";
const NLSC_MAP_REFERER = "https://maps.nlsc.gov.tw/T09/";

export type NlscMapKind = "ADDRESS" | "CROSSROAD" | "LANDGOAL" | "other";

export type NlscMapHit = {
  fullAddress: string;
  location: LngLat;
  kind: NlscMapKind;
  remark: string;
};

export type HouseholdAddressCandidate = {
  fullAddress: string;
  location: LngLat;
  matchType: string;
};

export type NlscTownVillage = {
  city: string;
  town: string;
  officeName: string;
  sectionName: string;
};

export type LandCrossCheck = NlscTownVillage & {
  matched: boolean;
};

type TgosInfo = {
  OutMatchType?: string;
  "比對結果類型"?: string;
};

type TgosAddress = {
  FULL_ADDR?: string;
  X?: number | string;
  Y?: number | string;
  "完整地址"?: string;
  "X坐標"?: number | string;
  "Y坐標"?: number | string;
};

type TgosResponse = {
  Info?: TgosInfo[];
  AddressList?: TgosAddress[];
  "回傳資訊"?: TgosInfo[];
  "門牌清單"?: TgosAddress[];
};

function decodeXmlText(value: string) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x([\da-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}

function xmlValue(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? decodeXmlText(match[1].trim()) : "";
}

function normalizeArea(value: string) {
  return value.replaceAll("台", "臺").replace(/\s+/g, "");
}

export function householdAddressConfigured() {
  return Boolean(process.env.TGOS_APP_ID && process.env.TGOS_API_KEY);
}

function kindFromNlscKey(key: string): NlscMapKind {
  if (key.includes(",ADDRESS,")) return "ADDRESS";
  if (key.includes(",CROSSROAD,")) return "CROSSROAD";
  if (key.includes(",LANDGOAL,")) return "LANDGOAL";
  return "other";
}

function parseNlscLocation(value: string): LngLat | null {
  const [lngRaw, latRaw] = value.split(",");
  const lng = Number(lngRaw);
  const lat = Number(latRaw);
  if (
    !Number.isFinite(lng) ||
    !Number.isFinite(lat) ||
    lng < 118 ||
    lng > 123 ||
    lat < 20 ||
    lat > 27
  ) {
    return null;
  }
  return { lng, lat };
}

/** 國土測繪圖資服務雲公開模糊檢索（門牌／路口／地標），免申請金鑰。 */
export async function searchNlscMapHits(
  address: string,
  bias?: LngLat,
  timeoutMs = 3_000,
): Promise<NlscMapHit[]> {
  const query = address.replace(/[\\/]/g, "").trim();
  if (query.length < 2) return [];
  const center = bias ?? { lng: 120.2049, lat: 22.9878 };
  const url = `${NLSC_MAP_SEARCH}/${encodeURIComponent(query)}/10/${center.lng}/${center.lat}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/xml, text/xml",
        Referer: NLSC_MAP_REFERER,
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const xml = await response.text();
    const items = [...xml.matchAll(/<ITEM>([\s\S]*?)<\/ITEM>/gi)];
    return items.flatMap((match) => {
      const block = match[1];
      const content = xmlValue(block, "CONTENT");
      const key = xmlValue(block, "KEY");
      const remark = xmlValue(block, "REMARK");
      const location = parseNlscLocation(xmlValue(block, "LOCATION"));
      if (!content || !location) return [];
      return [
        {
          fullAddress: content.replace(/[０-９]/g, (digit) =>
            String.fromCharCode(digit.charCodeAt(0) - 0xfee0),
          ),
          location,
          kind: kindFromNlscKey(key),
          remark,
        },
      ];
    });
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export function describeNlscHit(hit: NlscMapHit) {
  if (hit.kind === "ADDRESS") return "國土測量雲 · 建物門牌";
  if (hit.kind === "CROSSROAD") return "國土測量雲 · 交叉路口";
  if (hit.kind === "LANDGOAL") return "國土測量雲 · 地標";
  return "國土測量雲 · 定位";
}

export async function searchHouseholdAddresses(
  address: string,
): Promise<HouseholdAddressCandidate[]> {
  const appId = process.env.TGOS_APP_ID;
  const apiKey = process.env.TGOS_API_KEY;
  if (!appId || !apiKey) return [];

  const lockCounty = /[縣市]/.test(address);
  const lockTown = /[區鎮鄉]/.test(address);
  const body = new URLSearchParams({
    oAPPId: appId,
    oAPIKey: apiKey,
    oAddress: address,
    oSRS: "EPSG:4326",
    oFuzzyType: "2",
    oResultDataType: "JSON",
    oFuzzyBuffer: "50",
    oIsOnlyFullMatch: "false",
    oIsLockCounty: lockCounty ? "true" : "false",
    oIsLockTown: lockTown ? "true" : "false",
    oIsLockVillage: "false",
    oIsLockRoadSection: "false",
    oIsLockLane: "false",
    oIsLockAlley: "false",
    oIsLockArea: "false",
    oIsSameNumber_SubNumber: "true",
    oCanIgnoreVillage: "true",
    oCanIgnoreNeighborhood: "true",
    oReturnMaxCount: "6",
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3_500);

  try {
    const response = await fetch(TGOS_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/xml, text/xml",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body,
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const xml = await response.text();
    const wrapped = xml.match(/<string[^>]*>([\s\S]*?)<\/string>/i)?.[1];
    if (!wrapped) return [];
    const payload = JSON.parse(decodeXmlText(wrapped)) as TgosResponse;
    const rows = payload.AddressList ?? payload["門牌清單"] ?? [];
    const info = (payload.Info ?? payload["回傳資訊"] ?? [])[0];
    const matchType = info?.OutMatchType ?? info?.["比對結果類型"] ?? "門牌比對";

    return rows.flatMap((row) => {
      const lng = Number(row.X ?? row["X坐標"]);
      const lat = Number(row.Y ?? row["Y坐標"]);
      const fullAddress = row.FULL_ADDR ?? row["完整地址"] ?? address;
      if (
        !Number.isFinite(lng) ||
        !Number.isFinite(lat) ||
        lng < 118 ||
        lng > 123 ||
        lat < 20 ||
        lat > 27
      ) {
        return [];
      }
      return [{ fullAddress, location: { lng, lat }, matchType }];
    });
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function queryNlscTownVillage(
  location: LngLat,
): Promise<NlscTownVillage | null> {
  const url = `${NLSC_LAND_ENDPOINT}/${location.lng}/${location.lat}/4326`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4_000);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/xml, text/xml" },
      next: { revalidate: 86_400 },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const xml = await response.text();
    const city = xmlValue(xml, "ctyName");
    const town = xmlValue(xml, "townName");
    if (!city && !town) return null;
    return {
      city,
      town,
      officeName: xmlValue(xml, "officeName"),
      sectionName: xmlValue(xml, "sectName"),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function crossCheckLandArea(
  location: LngLat,
  expected: { city: string; town: string },
): Promise<LandCrossCheck | null> {
  const area = await queryNlscTownVillage(location);
  if (!area) return null;
  const expectedCity = normalizeArea(expected.city);
  const expectedTown = normalizeArea(expected.town);

  return {
    ...area,
    matched:
      (!expectedCity || normalizeArea(area.city) === expectedCity) &&
      (!expectedTown || normalizeArea(area.town) === expectedTown),
  };
}

export function describeLandCrossCheck(check: LandCrossCheck | null) {
  if (!check) return "地政資料暫時無法比對";
  if (!check.matched) return "地政行政區待確認";
  const office = check.officeName
    ? check.officeName.includes("事務所")
      ? check.officeName
      : `${check.officeName}地政事務所`
    : "地政行政區";
  const detail = [office, check.sectionName].filter(Boolean).join("／");
  return `地政相符${detail ? `（${detail}）` : ""}`;
}
