import type { DeliveryStore, MenuItem } from "@/lib/delivery/types";

export const DELIVERY_STORES: DeliveryStore[] = [
  {
    id: "store-anping",
    name: "安平海鮮便當",
    address: "臺南市安平區安平路",
    lng: 120.1605,
    lat: 22.9932,
  },
  {
    id: "store-guohua",
    name: "國華街米粉湯",
    address: "臺南市中西區國華街",
    lng: 120.1935,
    lat: 22.9972,
  },
  {
    id: "store-east",
    name: "東區咖啡",
    address: "臺南市東區東門路",
    lng: 120.2224,
    lat: 22.9841,
  },
];

export const DELIVERY_MENU: MenuItem[] = [
  { id: "anping-bento", storeId: "store-anping", name: "招牌便當", priceCents: 0 },
  { id: "anping-soup", storeId: "store-anping", name: "魚湯", priceCents: 0 },
  { id: "guohua-rice", storeId: "store-guohua", name: "米粉湯", priceCents: 0 },
  { id: "guohua-bowl", storeId: "store-guohua", name: "肉燥飯", priceCents: 0 },
  { id: "east-coffee", storeId: "store-east", name: "美式咖啡", priceCents: 0 },
  { id: "east-cake", storeId: "store-east", name: "蛋糕切片", priceCents: 0 },
];

export function menuForStore(storeId: string) {
  return DELIVERY_MENU.filter((item) => item.storeId === storeId);
}
