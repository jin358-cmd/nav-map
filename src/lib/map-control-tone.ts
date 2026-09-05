import { resolveMapBasemap } from "@/lib/map-display-mode";
import { cn } from "@/lib/utils";
import type { MapDisplayMode } from "@/types/domain";

export type MapControlTone = "light" | "dark" | "satellite";

export function mapControlTone(mode: MapDisplayMode): MapControlTone {
  return resolveMapBasemap(mode);
}

export function mapControlButtonClass(tone: MapControlTone, active = false) {
  if (tone === "satellite") {
    return cn(
      "border-[#111827]/70 bg-white/94 text-[#111827] shadow-lg hover:bg-zinc-100 hover:text-[#0f172a]",
      active && "border-[#0f172a] bg-zinc-100 text-[#0f172a]",
    );
  }
  if (tone === "dark") {
    return cn(
      "border-[#111827]/55 bg-zinc-100/94 text-[#1F2937] shadow-lg hover:bg-white hover:text-[#111827]",
      active && "border-[#111827] bg-white text-[#111827]",
    );
  }
  return cn(
    "border-zinc-400/80 bg-white/92 text-[#1F2937] shadow-lg hover:bg-zinc-100 hover:text-[#111827]",
    active && "border-[#111827] bg-zinc-100 text-[#111827]",
  );
}

export function mapStyleOptionClass(
  tone: MapControlTone,
  selected: boolean,
  pending: boolean,
) {
  return cn(
    "bg-white/94 text-[#1F2937] hover:bg-zinc-100",
    selected && "bg-zinc-100 text-[#111827] ring-1 ring-[#111827]/70",
    pending && "ring-1 ring-[#1F2937]/45",
    tone === "satellite" && "border border-[#111827]/20",
  );
}
