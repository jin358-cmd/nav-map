export const NAVPILOT_SUPABASE_PROJECT_REF = "rxzbsthsqlozxgctdoks";

export function isNavPilotProjectUrl(url: string) {
  try {
    return new URL(url).hostname === `${NAVPILOT_SUPABASE_PROJECT_REF}.supabase.co`;
  } catch {
    return false;
  }
}
