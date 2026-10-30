import { TDX_API_BASE, TDX_TOKEN_URL } from "../traffic-constants";
import { normalizeTdxLivePayload } from "./normalize-tdx";
import type { SourceNormalizeResult } from "./types";

export type TdxLiveSource = {
  id: string;
  path: string;
  city: string | null;
  label: string;
};

export const TDX_LIVE_SOURCES: TdxLiveSource[] = [
  { id: "tdx:Freeway", path: "/v1/Traffic/RoadEvent/LiveEvent/Freeway", city: null, label: "TDX 高速公路" },
  { id: "tdx:Highway", path: "/v1/Traffic/RoadEvent/LiveEvent/Highway", city: null, label: "TDX 快速公路" },
  { id: "tdx:City:Taipei", path: "/v1/Traffic/RoadEvent/LiveEvent/City/Taipei", city: "taipei", label: "TDX 臺北市" },
  { id: "tdx:City:NewTaipei", path: "/v1/Traffic/RoadEvent/LiveEvent/City/NewTaipei", city: "new-taipei", label: "TDX 新北市" },
  { id: "tdx:City:Taoyuan", path: "/v1/Traffic/RoadEvent/LiveEvent/City/Taoyuan", city: "taoyuan", label: "TDX 桃園市" },
  { id: "tdx:City:Taichung", path: "/v1/Traffic/RoadEvent/LiveEvent/City/Taichung", city: "taichung", label: "TDX 臺中市" },
  { id: "tdx:City:Tainan", path: "/v1/Traffic/RoadEvent/LiveEvent/City/Tainan", city: "tainan", label: "TDX 臺南市" },
  { id: "tdx:City:Kaohsiung", path: "/v1/Traffic/RoadEvent/LiveEvent/City/Kaohsiung", city: "kaohsiung", label: "TDX 高雄市" },
  { id: "tdx:City:Keelung", path: "/v1/Traffic/RoadEvent/LiveEvent/City/Keelung", city: "keelung", label: "TDX 基隆市" },
  { id: "tdx:City:MiaoliCounty", path: "/v1/Traffic/RoadEvent/LiveEvent/City/MiaoliCounty", city: "miaoli", label: "TDX 苗栗縣" },
  { id: "tdx:City:ChiayiCounty", path: "/v1/Traffic/RoadEvent/LiveEvent/City/ChiayiCounty", city: "chiayi-county", label: "TDX 嘉義縣" },
  { id: "tdx:City:PingtungCounty", path: "/v1/Traffic/RoadEvent/LiveEvent/City/PingtungCounty", city: "pingtung", label: "TDX 屏東縣" },
  { id: "tdx:City:YilanCounty", path: "/v1/Traffic/RoadEvent/LiveEvent/City/YilanCounty", city: "yilan", label: "TDX 宜蘭縣" },
  { id: "tdx:City:KinmenCounty", path: "/v1/Traffic/RoadEvent/LiveEvent/City/KinmenCounty", city: "kinmen", label: "TDX 金門縣" },
];

export type TdxCredentials = { clientId: string; clientSecret: string };

type TokenCache = { clientId: string; token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;
let lastDataCallAt = 0;

const DEFAULT_PAGE_SIZE = 1000;
const MAX_PAGES = 12;
const DEFAULT_GAP_MS = 12_000;

export type TdxSourceFetch = SourceNormalizeResult & {
  httpStatus: number | null;
  calls: number;
  rawPages: unknown[];
};

function failed(source: TdxLiveSource, error: string, httpStatus: number | null, calls: number): TdxSourceFetch {
  return {
    sourceDataset: source.id,
    ok: false,
    error,
    updateTime: null,
    rawCount: 0,
    uniqueCount: 0,
    byEventType: {},
    withCoordinates: 0,
    activeCount: 0,
    events: [],
    httpStatus,
    calls,
    rawPages: [],
  };
}

async function accessToken(
  credentials: TdxCredentials,
  fetchImpl: typeof fetch,
  timeoutMs: number,
) {
  if (tokenCache && tokenCache.clientId === credentials.clientId && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
  });
  const response = await fetchImpl(TDX_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`TDX token ${response.status}`);
  const json = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("TDX token missing access_token");
  const ttlMs = Math.max((json.expires_in ?? 3600) - 60, 60) * 1000;
  tokenCache = {
    clientId: credentials.clientId,
    token: json.access_token,
    expiresAt: Date.now() + ttlMs,
  };
  return json.access_token;
}

async function pace(gapMs: number, sleep: (ms: number) => Promise<void>) {
  const wait = Math.max(0, lastDataCallAt + gapMs - Date.now());
  if (wait) await sleep(wait);
  lastDataCallAt = Date.now();
}

async function getPage(
  source: TdxLiveSource,
  credentials: TdxCredentials,
  skip: number,
  pageSize: number,
  fetchImpl: typeof fetch,
  timeoutMs: number,
  retried = false,
): Promise<{ status: number; body: unknown }> {
  const token = await accessToken(credentials, fetchImpl, timeoutMs);
  const url = new URL(`${TDX_API_BASE}${source.path}`);
  url.searchParams.set("$format", "JSON");
  url.searchParams.set("$top", String(pageSize));
  if (skip) url.searchParams.set("$skip", String(skip));
  const response = await fetchImpl(url, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (response.status === 401 && !retried) {
    tokenCache = null;
    return getPage(source, credentials, skip, pageSize, fetchImpl, timeoutMs, true);
  }
  if (!response.ok) {
    return { status: response.status, body: null };
  }
  return { status: response.status, body: await response.json() };
}

export async function fetchTdxLiveSources(options: {
  credentials: TdxCredentials;
  sources?: TdxLiveSource[];
  pageSize?: number;
  minGapMs?: number;
  timeoutMs?: number;
  includeRaw?: boolean;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}): Promise<TdxSourceFetch[]> {
  const sources = options.sources ?? TDX_LIVE_SOURCES;
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const gapMs = options.minGapMs ?? DEFAULT_GAP_MS;
  const timeoutMs = options.timeoutMs ?? 20_000;
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const results: TdxSourceFetch[] = [];

  for (const source of sources) {
    const rawPages: unknown[] = [];
    let calls = 0;
    try {
      const rowsPayload: unknown[] = [];
      const seen = new Set<string>();
      let skip = 0;
      let updateTime: string | null = null;
      for (let page = 0; page < MAX_PAGES; page += 1) {
        await pace(gapMs, sleep);
        calls += 1;
        const response = await getPage(
          source,
          options.credentials,
          skip,
          pageSize,
          fetchImpl,
          timeoutMs,
        );
        if (response.body == null) {
          if (page === 0) {
            results.push(failed(source, `TDX ${source.path} ${response.status}`, response.status, calls));
          }
          break;
        }
        rawPages.push(response.body);
        const record = response.body as { LiveEvents?: { EventID?: string }[]; UpdateTime?: string };
        const live = Array.isArray(record.LiveEvents) ? record.LiveEvents : [];
        updateTime = updateTime ?? (typeof record.UpdateTime === "string" ? record.UpdateTime : null);
        const novel = live.filter((row) => {
          const id = typeof row?.EventID === "string" ? row.EventID : "";
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        if (!novel.length) break;
        rowsPayload.push(...live);
        if (live.length < pageSize) break;
        skip += live.length;
      }
      if (results.at(-1)?.sourceDataset === source.id && results.at(-1)?.ok === false) {
        continue;
      }
      const combined = { UpdateTime: updateTime, LiveEvents: rowsPayload };
      const normalized = normalizeTdxLivePayload(combined, source);
      results.push({
        ...normalized,
        httpStatus: 200,
        calls,
        rawPages: options.includeRaw ? rawPages : [],
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      const message = timedOut ? "timeout" : error instanceof Error ? error.message : "upstream";
      results.push(failed(source, message, null, calls));
    }
  }
  return results;
}

export function resetTdxFetchState() {
  tokenCache = null;
  lastDataCallAt = 0;
}
