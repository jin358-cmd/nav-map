import type { LucideIcon } from "lucide-react";
import { BedDouble, Fuel, Store, UtensilsCrossed } from "lucide-react";
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
    hint: "含汽機車充電站",
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
