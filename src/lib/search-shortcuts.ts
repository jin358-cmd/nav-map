import type { LucideIcon } from "lucide-react";
import {
  BatteryCharging,
  BedDouble,
  CircleDot,
  Fuel,
  Package,
  PlugZap,
  ShoppingBag,
  ShoppingBasket,
  Store,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import type { ConvenienceKind } from "@/lib/poi/convenience-kind";
import type { EnergyKind } from "@/lib/poi/energy-kind";
import type { PoiCategory } from "@/lib/poi/schema";

export const SEARCH_SHORTCUT_IDS = [
  "fuel",
  "convenience",
  "restaurant",
  "hotel",
] as const;

export type SearchShortcutId = (typeof SEARCH_SHORTCUT_IDS)[number];

export type SearchShortcut = {
  id: SearchShortcutId;
  label: string;
  hint: string;
  icon: LucideIcon;
  color: string;
  categories: PoiCategory[];
};

export const SEARCH_SHORTCUTS: SearchShortcut[] = [
  {
    id: "fuel",
    label: "加油站",
    hint: "汽柴油站；點入後可看 Gogoro、Tesla 超充與電車充電站",
    icon: Fuel,
    color: "#f59e0b",
    categories: ["fuel"],
  },
  {
    id: "convenience",
    label: "超商",
    hint: "便利商店；點入後可看統一、全家、萊爾富、OK Mart 與蝦皮店到店",
    icon: Store,
    color: "#34d399",
    categories: ["convenience"],
  },
  {
    id: "restaurant",
    label: "餐廳",
    hint: "附近餐廳",
    icon: UtensilsCrossed,
    color: "#fb923c",
    categories: ["restaurant"],
  },
  {
    id: "hotel",
    label: "飯店住宿",
    hint: "飯店、旅館、民宿",
    icon: BedDouble,
    color: "#60a5fa",
    categories: ["hotel"],
  },
];

export function searchShortcutById(id: string | null): SearchShortcut | null {
  if (!id) return null;
  return SEARCH_SHORTCUTS.find((item) => item.id === id) ?? null;
}

export type FuelEnergyShortcut = {
  id: Exclude<EnergyKind, "petrol">;
  label: string;
  hint: string;
  icon: LucideIcon;
  color: string;
};

export const FUEL_ENERGY_SHORTCUTS: FuelEnergyShortcut[] = [
  {
    id: "gogoro",
    label: "Gogoro充電站",
    hint: "Gogoro 電池交換站",
    icon: BatteryCharging,
    color: "#22c55e",
  },
  {
    id: "tesla",
    label: "Tesla超充站",
    hint: "Tesla Supercharger",
    icon: Zap,
    color: "#e82127",
  },
  {
    id: "ev",
    label: "電車充電站",
    hint: "汽車充電樁",
    icon: PlugZap,
    color: "#38bdf8",
  },
];

export function fuelEnergyShortcutById(
  id: EnergyKind | null,
): FuelEnergyShortcut | null {
  if (!id || id === "petrol") return null;
  return FUEL_ENERGY_SHORTCUTS.find((item) => item.id === id) ?? null;
}

export type ConvenienceBrandShortcut = {
  id: Exclude<ConvenienceKind, "all">;
  label: string;
  hint: string;
  icon: LucideIcon;
  color: string;
};

export const CONVENIENCE_BRAND_SHORTCUTS: ConvenienceBrandShortcut[] = [
  {
    id: "seven",
    label: "統一",
    hint: "統一超商 7-ELEVEN",
    icon: Store,
    color: "#00703c",
  },
  {
    id: "familymart",
    label: "全家",
    hint: "全家便利商店",
    icon: ShoppingBag,
    color: "#0078c8",
  },
  {
    id: "hilife",
    label: "萊爾富",
    hint: "萊爾富",
    icon: ShoppingBasket,
    color: "#ff6a00",
  },
  {
    id: "okmart",
    label: "OK Mart",
    hint: "OK 超商",
    icon: CircleDot,
    color: "#e31c25",
  },
  {
    id: "shopee",
    label: "蝦皮店到店",
    hint: "蝦皮店到店取件點",
    icon: Package,
    color: "#ee4d2d",
  },
];

export function convenienceBrandShortcutById(
  id: ConvenienceKind | null,
): ConvenienceBrandShortcut | null {
  if (!id || id === "all") return null;
  return CONVENIENCE_BRAND_SHORTCUTS.find((item) => item.id === id) ?? null;
}
