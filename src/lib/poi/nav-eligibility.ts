import type { TaiwanPoiRecord } from "@/lib/poi/schema";

/** <40 不進主要 Suggest；60–79 可導航但次一級；80+ 高可信。 */
export const MIN_SUGGEST_NAV_SCORE = 40;
export const MIN_NAV_READY_SCORE = 60;
export const HIGH_NAV_SCORE = 80;

export type MatchQuality = "A" | "B" | "C" | "D" | "E";

export function poiNavScore(poi: Pick<TaiwanPoiRecord, "navEligibilityScore" | "source">) {
  if (typeof poi.navEligibilityScore === "number") return poi.navEligibilityScore;
  return poi.source === "gov" ? 50 : 72;
}

export function isSuggestEligiblePoi(poi: TaiwanPoiRecord) {
  if (!poi.isActive) return false;
  const quality = poi.matchQuality;
  if (quality === "D" || quality === "E") return false;
  return poiNavScore(poi) >= MIN_SUGGEST_NAV_SCORE;
}

export function isLocationIncomplete(poi: Pick<TaiwanPoiRecord, "navEligibilityScore" | "matchQuality">) {
  if (poi.matchQuality === "C" || poi.matchQuality === "D") return true;
  if (typeof poi.navEligibilityScore === "number" && poi.navEligibilityScore < MIN_NAV_READY_SCORE) {
    return true;
  }
  return false;
}

export function registryRankBoost(poi: Pick<TaiwanPoiRecord, "registryType" | "navEligibilityScore">) {
  let boost = 0;
  if (poi.registryType === "business") boost += 8;
  if (poi.registryType === "company") boost -= 3;
  const score = typeof poi.navEligibilityScore === "number" ? poi.navEligibilityScore : 70;
  boost += Math.round(score / 12);
  return boost;
}
