import "server-only";
import {
  TDX_API_BASE,
  TDX_PAGE_SIZE,
  TDX_TAINAN_CITY,
  TDX_TOKEN_URL,
} from "@/lib/traffic-constants";
import {
  unwrapTdxList,
  type TdxLiveRow,
  type TdxSectionRow,
  type TdxShapeRow,
} from "@/lib/traffic-normalize";

type TdxToken = {
  access_token: string;
  expires_in?: number;
};

type CachedToken = {
  accessToken: string;
  expiresAt: number;
};

let tokenCache: CachedToken | null = null;

export function getTdxCredentials(): {
  clientId: string;
  clientSecret: string;
} | null {
  const clientId = process.env.TDX_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.TDX_CLIENT_SECRET?.trim() || "";
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isTdxConfigured(): boolean {
  return getTdxCredentials() !== null;
}

export async function fetchTainanCityLive(): Promise<TdxLiveRow[]> {
  const payload = await fetchTdxJson(
    `/v2/Road/Traffic/Live/City/${TDX_TAINAN_CITY}`,
  );
  return unwrapTdxList<TdxLiveRow>(payload, ["LiveTraffics", "liveTraffics"]);
}

export async function fetchTainanCitySections(): Promise<TdxSectionRow[]> {
  const payload = await fetchTdxJson(
    `/v2/Road/Traffic/Section/City/${TDX_TAINAN_CITY}`,
  );
  return unwrapTdxList<TdxSectionRow>(payload, ["Sections", "sections"]);
}

export async function fetchTainanCityShapes(): Promise<TdxShapeRow[]> {
  const payload = await fetchTdxJson(
    `/v2/Road/Traffic/SectionShape/City/${TDX_TAINAN_CITY}`,
  );
  return unwrapTdxList<TdxShapeRow>(payload, [
    "SectionShapes",
    "sectionShapes",
  ]);
}

export async function fetchTainanCityIncidents(): Promise<Record<string, unknown>[]> {
  const payload = await fetchTdxJson(
    `/v2/Road/Traffic/Incident/City/${TDX_TAINAN_CITY}`,
  );
  return unwrapTdxList<Record<string, unknown>>(payload, [
    "Incidents",
    "incidents",
  ]);
}

export async function fetchTainanCityNews(): Promise<Record<string, unknown>[]> {
  const payload = await fetchTdxJson(
    `/v2/Road/Traffic/News/City/${TDX_TAINAN_CITY}`,
  );
  return unwrapTdxList<Record<string, unknown>>(payload, ["News", "news"]);
}

async function fetchTdxJson(path: string): Promise<unknown> {
  const url = new URL(`${TDX_API_BASE}${path}`);
  url.searchParams.set("$format", "JSON");
  url.searchParams.set("$top", String(TDX_PAGE_SIZE));

  const response = await authorizedFetch(url);
  if (!response.ok) {
    throw new Error(`TDX ${path} ${response.status}`);
  }
  return response.json();
}

async function authorizedFetch(url: URL, retried = false): Promise<Response> {
  const token = await getAccessToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (response.status === 401 && !retried) {
      tokenCache = null;
      return authorizedFetch(url, true);
    }
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.accessToken;
  }

  const credentials = getTdxCredentials();
  if (!credentials) {
    throw new Error("TDX credentials are not configured");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(TDX_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`TDX token ${response.status}`);
    }
    const json = (await response.json()) as TdxToken;
    if (!json.access_token) {
      throw new Error("TDX token missing access_token");
    }
    const ttlMs = Math.max((json.expires_in ?? 3600) - 60, 60) * 1000;
    tokenCache = {
      accessToken: json.access_token,
      expiresAt: Date.now() + ttlMs,
    };
    return json.access_token;
  } finally {
    clearTimeout(timer);
  }
}
