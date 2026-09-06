import "server-only";

export type SupabaseConfig = {
  url: string;
  serviceKey: string;
};

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!url || !serviceKey) return null;
  return { url: url.replace(/\/$/, ""), serviceKey };
}

export function isSupabaseConfigured() {
  return getSupabaseConfig() !== null;
}

export function supabaseHeaders(config: SupabaseConfig, extra?: HeadersInit) {
  return {
    apikey: config.serviceKey,
    Authorization: `Bearer ${config.serviceKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    ...extra,
  };
}

export async function supabaseRest<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const config = getSupabaseConfig();
  if (!config) return { ok: false, status: 0, data: null };
  const response = await fetch(`${config.url}${path}`, {
    ...init,
    headers: supabaseHeaders(config, init?.headers),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, status: response.status, data: null };
  }
  if (response.status === 204) {
    return { ok: true, status: response.status, data: null };
  }
  try {
    return { ok: true, status: response.status, data: (await response.json()) as T };
  } catch {
    return { ok: true, status: response.status, data: null };
  }
}
