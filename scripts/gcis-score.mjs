/**
 * nav_eligibility_score 0–100：公司登記地址 ≠ 實體門市時往下壓。
 */
import { floorLevel, hasHouseNumber, looksLikeOfficeTower } from "./gcis-address.mjs";

const MAIN_INDUSTRY = {
  food: /餐館|飲料|便利商店|超級市場|食品|烘焙|農產|水產|畜產|菸酒/,
  clothing: /布疋|衣著|鞋|帽|傘|服飾|化粧品|眼鏡|鐘錶/,
  housing: /日常用品|電器|五金|建材/,
  transport: /機車|汽車|零件|加油站/,
  education: /文教|樂器|補習/,
  leisure: /美容|美髮|瘦身|寵物|百貨/,
  medical: /西藥|中藥/,
};

export function parseProducedAt(value) {
  const raw = String(value ?? "").replace(/\D/g, "");
  if (raw.length < 8) return null;
  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(4, 6));
  const day = Number(raw.slice(6, 8));
  if (!year || !month || !day) return null;
  return Date.UTC(year, month - 1, day);
}

export function navEligibilityScore({
  registryType,
  address,
  matchQuality,
  addressEntityCount = 1,
  brand = null,
  osmMatched = false,
  industry = "",
  mainCategory = "",
  sourceUpdatedAt = "",
  hasPhone = false,
}) {
  let score = 48;
  if (registryType === "business") score += 18;
  else if (registryType === "company") score -= 4;

  const floor = floorLevel(address);
  if (floor === 0 || floor === 1 || floor === 2) score += 10;
  else if (floor != null && floor >= 3) score -= 16;

  if (hasHouseNumber(address)) score += 10;
  else score -= 8;

  if (osmMatched) score += 12;
  if (brand) score += 10;
  if (hasPhone) score += 4;

  if (looksLikeOfficeTower(address)) score -= 18;

  if (matchQuality === "A") score += 8;
  else if (matchQuality === "B") score += 4;
  else if (matchQuality === "C") score -= 10;
  else if (matchQuality === "D") score -= 22;
  else if (matchQuality === "E") score -= 40;

  const clustered = Number(addressEntityCount) || 1;
  if (clustered >= 100) score -= 28;
  else if (clustered >= 50) score -= 20;
  else if (clustered >= 20) score -= 12;
  else if (clustered >= 8) score -= 6;

  const industryRe = MAIN_INDUSTRY[mainCategory];
  if (industryRe && industryRe.test(industry)) score += 6;

  const produced = parseProducedAt(sourceUpdatedAt);
  if (produced) {
    const ageDays = (Date.now() - produced) / 86_400_000;
    if (ageDays <= 400) score += 6;
    else if (ageDays <= 800) score += 3;
    else if (ageDays > 2000) score -= 4;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function isNavReady(quality, score) {
  return (quality === "A" || quality === "B") && score >= 60;
}

export function suggestEligible(quality, score) {
  if (score < 40) return false;
  return quality === "A" || quality === "B" || quality === "C";
}
