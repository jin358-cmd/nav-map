const SOUTH_COUNTIES = [
  "雲林縣",
  "嘉義市",
  "嘉義縣",
  "臺南市",
  "高雄市",
  "屏東縣",
] as const;

export type SupabaseAnonConfig = {
  url: string;
  anonKey: string;
};

/** Public search only. Never returns a service-role key. */
export function getSupabaseAnonConfig(): SupabaseAnonConfig | null {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const anonKey = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  ).trim();
  if (!url || !anonKey) return null;
  if (/service_role/i.test(anonKey)) return null;
  return { url: url.replace(/\/$/, ""), anonKey };
}

export function southAddressCountyFilter() {
  return SOUTH_COUNTIES.join(",");
}

export { SOUTH_COUNTIES };
