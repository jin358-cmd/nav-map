/** Map 經濟部營業項目名稱 → POI category + 中華黃頁水平分類. */

export const STOREFRONT_INDUSTRIES = [
  { title: "餐館業", category: "restaurant", subcategory: "restaurant" },
  { title: "餐廳餐館", category: "restaurant", subcategory: "restaurant" },
  { title: "飲料店業", category: "cafe", subcategory: "drink" },
  { title: "便利商店", category: "convenience", subcategory: "convenience" },
  { title: "超級市場業", category: "supermarket", subcategory: "supermarket" },
  { title: "百貨公司業", category: "mall", subcategory: "department-store" },
  { title: "其他綜合零售", category: "supermarket", subcategory: "food-shop" },
  { title: "食品什貨、飲料零售業", category: "supermarket", subcategory: "food-shop" },
  { title: "農產品零售業", category: "supermarket", subcategory: "food-shop" },
  { title: "水產品零售業", category: "supermarket", subcategory: "food-shop" },
  { title: "畜產品零售業", category: "supermarket", subcategory: "food-shop" },
  { title: "菸酒零售業", category: "supermarket", subcategory: "food-shop" },
  { title: "烘焙炊蒸食品製造業", category: "restaurant", subcategory: "bakery" },
  { title: "布疋、衣著、鞋、帽、傘、服飾品零售業", category: "mall", subcategory: "clothing" },
  { title: "化粧品零售業", category: "mall", subcategory: "accessories" },
  { title: "眼鏡零售業", category: "mall", subcategory: "accessories" },
  { title: "鐘錶零售業", category: "mall", subcategory: "accessories" },
  { title: "日常用品零售業", category: "other", subcategory: "houseware" },
  { title: "電器零售業", category: "other", subcategory: "houseware" },
  { title: "五金零售業", category: "other", subcategory: "hardware" },
  { title: "建材零售業", category: "other", subcategory: "building-materials" },
  { title: "西藥零售業", category: "pharmacy", subcategory: "pharmacy" },
  { title: "中藥零售業", category: "pharmacy", subcategory: "pharmacy" },
  { title: "加油站業", category: "fuel", subcategory: "fuel" },
  { title: "機車零售業", category: "other", subcategory: "car" },
  { title: "汽車零售業", category: "other", subcategory: "car" },
  { title: "汽、機車零件配備零售業", category: "other", subcategory: "auto-repair" },
  { title: "文教、樂器、育樂用品零售業", category: "school", subcategory: "bookstore" },
  { title: "短期補習班業", category: "school", subcategory: "tutoring" },
  { title: "美容美髮服務", category: "other", subcategory: "entertainment" },
  { title: "瘦身美容業", category: "other", subcategory: "entertainment" },
  { title: "特定寵物零售業", category: "other", subcategory: "entertainment" },
];

export function industryFromTitle(title) {
  const bare = String(title || "")
    .replace(/^公司登記\(依營業項目別）－/, "")
    .replace(/^公司登記\(依營業項目別\)－/, "")
    .replace(/^商業登記\(依營業項目別）－/, "")
    .replace(/^商業登記\(依營業項目別\)－/, "")
    .trim();
  return STOREFRONT_INDUSTRIES.find((item) => item.title === bare) || null;
}
