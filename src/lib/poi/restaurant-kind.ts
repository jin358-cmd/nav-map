export const RESTAURANT_KINDS = [
  "all",
  "fast",
  "chinese",
  "western",
  "vegetarian",
] as const;

export type RestaurantKind = (typeof RESTAURANT_KINDS)[number];

const VEG_RE = /素食|蔬食|齋堂|齋飯|全素|蛋素|vegan|vegetarian|無肉/i;

const FAST_BRANDS = new Set([
  "McDonald's",
  "MOS Burger",
  "KFC",
  "漢堡王",
  "Subway",
  "必勝客",
  "達美樂",
  "吉野家",
  "すき家",
  "胖老爹美式炸雞",
  "麥味登",
  "拉亞漢堡",
  "弘爺漢堡",
  "早安美芝城",
  "呷尚寶",
  "Qburger",
]);

const FAST_RE =
  /速食|mcdonald|麥當勞|kfc|肯德基|mos\s*burger|摩斯漢堡|漢堡王|subway|必勝客|達美樂|dominos?|吉野家|すき家|sukiya|胖老爹|麥味登|拉亞漢堡|弘爺漢堡|早安美芝城|呷尚寶|qburger|丹丹漢堡|頂呱呱|21世紀|德州炸雞|美式炸雞|fast\s*food|漢堡店/i;

const WESTERN_RE =
  /西餐|義大利|意大利|義式|法式|歐式|美式餐廳|牛排|pasta|pizza|piza|燉飯|risotto|義麵|早午餐|brunch|bistro|德國豬腳|西班牙|墨西哥|taco|漢堡排|烤雞餐廳/i;

const CHINESE_RE =
  /中餐|中式|熱炒|快炒|台菜|台灣菜|川菜|粵菜|湘菜|客家|江浙|上海菜|港式|合菜|便當|魯肉|滷肉|牛肉麵|火鍋|涮涮|麻辣|臭臭鍋|餃子|水餃|小籠|湯包|炒飯|炒麵|粥|食堂|麵店|飯館|小吃|臭豆腐|鹽酥雞|雞排|鐵板燒|羊肉爐|薑母鴨|米粉|粄條|鍋貼|水煎包|肉圓|筒仔米糕|爌肉|排骨飯|自助餐|豆漿|羹|焿|滷味|麵線|擔仔麵|陽春麵/i;

export type RestaurantFields = {
  name?: string | null;
  brand?: string | null;
  category?: string | null;
  subcategory?: string | null;
};

function haystack(poi: RestaurantFields) {
  return `${poi.name ?? ""} ${poi.brand ?? ""} ${poi.subcategory ?? ""}`;
}

export function isRestaurantKind(
  value: string | null | undefined,
): value is RestaurantKind {
  return Boolean(value && RESTAURANT_KINDS.includes(value as RestaurantKind));
}

export function classifyRestaurantKind(
  poi: RestaurantFields,
): RestaurantKind | null {
  const text = haystack(poi);
  if (VEG_RE.test(text)) return "vegetarian";
  if (poi.brand && FAST_BRANDS.has(poi.brand)) return "fast";
  if (FAST_RE.test(text)) return "fast";
  if (WESTERN_RE.test(text)) return "western";
  if (CHINESE_RE.test(text)) return "chinese";
  if (poi.category === "restaurant") return "all";
  return null;
}

export function matchesRestaurantKind(poi: RestaurantFields, kind: RestaurantKind) {
  if (kind === "all") return poi.category === "restaurant";
  return classifyRestaurantKind(poi) === kind;
}
