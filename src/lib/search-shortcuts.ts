import type { LucideIcon } from "lucide-react";
import { BatteryCharging, BedDouble, Fuel, Store, UtensilsCrossed, Zap } from "lucide-react";
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
    hint: "汽柴油站；點入後可看 Gogoro 與電車充電站",
    icon: Fuel,
    color: "#f59e0b",
    categories: ["fuel"],
  },
  {
    id: "convenience",
    label: "超商",
    hint: "便利商店",
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
    id: "ev",
    label: "電車充電站",
    hint: "汽車充電樁",
    icon: Zap,
    color: "#38bdf8",
  },
];

export function fuelEnergyShortcutById(
  id: EnergyKind | null,
): FuelEnergyShortcut | null {
  if (!id || id === "petrol") return null;
  return FUEL_ENERGY_SHORTCUTS.find((item) => item.id === id) ?? null;
}
