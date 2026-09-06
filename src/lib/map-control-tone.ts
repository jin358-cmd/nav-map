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
      "border-2 border-[#67e8f9] bg-[#041016]/90 text-[#67e8f9] shadow-[0_0_0_1px_rgba(103,232,249,0.35),0_8px_22px_rgba(8,47,73,0.55)] hover:bg-[#083344] hover:text-[#ecfeff]",
      active && "border-[#ecfeff] bg-[#22d3ee] text-[#042f2e]",
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
    "text-center",
    tone === "dark"
      ? "bg-[#0b1220]/90 text-[#e2e8f0] hover:bg-[#164e63]/80"
      : "bg-white/94 text-[#1F2937] hover:bg-zinc-100",
    selected &&
      (tone === "dark"
        ? "bg-[#22d3ee] text-[#042f2e] ring-1 ring-[#ecfeff]/80"
        : "bg-zinc-100 text-[#111827] ring-1 ring-[#111827]/70"),
    pending &&
      (tone === "dark"
        ? "ring-1 ring-[#67e8f9]/70"
        : "ring-1 ring-[#1F2937]/45"),
    tone === "satellite" && "border border-[#111827]/20",
  );
}
