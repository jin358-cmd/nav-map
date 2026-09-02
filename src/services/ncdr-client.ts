import "server-only";
import {
  DISASTER_FETCH_TIMEOUT_MS,
  NCDR_MEMBER_JSON_FEED,
  NCDR_PUBLIC_JSON_FEED,
  NCDR_USER_AGENT,
} from "@/lib/disaster-constants";

export function getNcdrApiKey() {
  return process.env.NCDR_API_KEY?.trim() || "";
}

export function isNcdrMemberConfigured() {
  return getNcdrApiKey().length > 0;
}

export async function fetchNcdrAlertFeed(): Promise<unknown> {
  const key = getNcdrApiKey();
  if (key) {
    try {
      return await fetchNcdrJson(memberFeedUrl(key));
    } catch (error) {
      console.warn(
        "NCDR member feed fallback to public JSON",
        error instanceof Error ? error.message : "unknown error",
      );
    }
  }
  return fetchNcdrJson(NCDR_PUBLIC_JSON_FEED);
}

async function fetchNcdrJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DISASTER_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": NCDR_USER_AGENT,
      },
    });
    if (!response.ok) {
      throw new Error(`NCDR feed ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function memberFeedUrl(apiKey: string) {
  const url = new URL(NCDR_MEMBER_JSON_FEED);
  url.searchParams.set("apikey", apiKey);
  return url.toString();
}
