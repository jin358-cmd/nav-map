/**
 * 從經濟部商工名稱辨識連鎖品牌與分店名。只做明確字樣，不做模糊名稱亂配。
 */

const BRANDS = [
  {
    brand: "7-Eleven",
    aliases: ["7-11", "711", "統一超商", "7-ELEVEN"],
    needles: ["統一超商", "7-eleven", "7-eleven", "7eleven"],
  },
  {
    brand: "FamilyMart",
    aliases: ["全家", "FamilyMart"],
    needles: ["全家便利商店", "全家便利", "familymart"],
  },
  {
    brand: "Hi-Life",
    aliases: ["萊爾富", "Hi-Life"],
    needles: ["萊爾富"],
  },
  {
    brand: "OK Mart",
    aliases: ["OK超商", "OKmart", "OK Mart"],
    needles: ["來來超商", "ok超商", "ok mart"],
  },
  {
    brand: "PX Mart",
    aliases: ["全聯", "全聯福利中心", "PX Mart"],
    needles: ["全聯福利中心", "全聯實業"],
  },
  {
    brand: "Carrefour",
    aliases: ["家樂福", "Carrefour"],
    needles: ["家樂福"],
  },
  {
    brand: "Costco",
    aliases: ["好市多", "Costco"],
    needles: ["好市多", "costco"],
  },
  {
    brand: "Starbucks",
    aliases: ["星巴克", "Starbucks"],
    needles: ["星巴克", "starbucks"],
  },
  {
    brand: "McDonald's",
    aliases: ["麥當勞", "McDonald's"],
    needles: ["麥當勞", "mcdonald"],
  },
  {
    brand: "Louisa",
    aliases: ["路易莎", "路易莎咖啡"],
    needles: ["路易莎"],
  },
  {
    brand: "85C",
    aliases: ["85度C", "85°C", "85C"],
    needles: ["85度c", "85℃", "美食達人"],
  },
  {
    brand: "CPC",
    aliases: ["中油", "台灣中油"],
    needles: ["台灣中油", "中國石油", "中油股份"],
  },
  {
    brand: "Formosa",
    aliases: ["台塑", "台塑石油"],
    needles: ["台塑石化", "台塑石油", "台塑加油站"],
  },
  {
    brand: "Simple Mart",
    aliases: ["美廉社"],
    needles: ["美廉社"],
  },
  {
    brand: "KFC",
    aliases: ["肯德基"],
    needles: ["肯德基"],
  },
  {
    brand: "MOS Burger",
    aliases: ["摩斯漢堡", "摩斯"],
    needles: ["摩斯漢堡"],
  },
];

function compact(value) {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll("臺", "台")
    .replace(/[（）()]/g, "")
    .replace(/[\s\-_.＋+°℃]/g, "");
}

export function detectBrand(name) {
  const hay = compact(name);
  for (const item of BRANDS) {
    if (item.needles.some((needle) => hay.includes(compact(needle)))) {
      return item;
    }
  }
  return null;
}

export function branchFromRegistryName(name, brandMeta) {
  const text = String(name ?? "");
  const branch =
    text.match(/公司(.+?(?:分公司|營業所|門市|加油站|店))$/u)?.[1] ||
    text.match(/(?:分公司|商業)[-－](.+)$/u)?.[1] ||
    text.match(/第.+?(?:分公司|門市)/u)?.[0] ||
    null;
  if (branch) return branch.replace(/^之/, "").trim();
  if (brandMeta?.brand === "7-Eleven") {
    const uni = text.match(/統一超商股份有限公司(.+)$/u)?.[1];
    if (uni) return uni;
  }
  return null;
}

export function brandFields(name) {
  const meta = detectBrand(name);
  if (!meta) {
    return { brand: null, branchName: null, aliases: [] };
  }
  return {
    brand: meta.brand,
    branchName: branchFromRegistryName(name, meta),
    aliases: meta.aliases,
  };
}
