import { resolveMapBasemap } from "@/lib/map-display-mode";
import { cn } from "@/lib/utils";
import type { MapDisplayMode } from "@/types/domain";

export type MapControlTone = "light" | "dark" | "satellite";

export function mapControlTone(mode: MapDisplayMode): MapControlTone {
  return resolveMapBasemap(mode);
}

export function mapControlButtonClass(tone: MapControlTone, active = false) {
  if (tone === "light") {
    return cn(
      "border-zinc-400/80 bg-white/92 text-[#1F2937] shadow-lg hover:bg-zinc-100 hover:text-[#111827]",
      active && "border-[#111827] bg-zinc-100 text-[#111827]",
    );
  }
  if (tone === "satellite") {
    return cn(
      "border-white/50 bg-zinc-950/88 text-white shadow-lg hover:bg-zinc-900 hover:text-white",
      active && "border-white bg-zinc-900 text-white",
    );
  }
  return cn(
    "border-zinc-300/70 bg-zinc-800/92 text-zinc-50 shadow-lg hover:bg-zinc-700 hover:text-white",
    active && "border-zinc-100 bg-zinc-700 text-white",
  );
}

export function mapStyleOptionClass(
  tone: MapControlTone,
  selected: boolean,
  pending: boolean,
) {
  if (tone === "light") {
    return cn(
      "bg-white/90 text-[#1F2937] hover:bg-zinc-100",
      selected && "bg-zinc-100 text-[#111827] ring-1 ring-[#1F2937]/70",
      pending && "ring-1 ring-[#1F2937]/40",
    );
  }
  if (tone === "satellite") {
    return cn(
      "bg-zinc-950/80 text-white hover:bg-zinc-900",
      selected && "bg-zinc-900 text-white ring-1 ring-white/80",
      pending && "ring-1 ring-white/40",
    );
  }
  return cn(
    "bg-zinc-800/80 text-zinc-50 hover:bg-zinc-700",
    selected && "bg-zinc-700 text-white ring-1 ring-zinc-100/80",
    pending && "ring-1 ring-zinc-100/40",
  );
}
