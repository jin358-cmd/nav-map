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
      "border-[#1e3a5f] bg-white/94 text-[#0f172a] shadow-lg hover:bg-sky-50 hover:text-[#0f172a]",
      active &&
        "!border-[#0c4a6e] !bg-[#0369a1] !text-white hover:!bg-[#0284c7] [&_svg]:!text-white",
    );
  }
  if (tone === "dark") {
    return cn(
      "!border-2 !border-[#67e8f9] !bg-[#041016] !text-[#ecfeff] shadow-[0_0_0_2px_rgba(103,232,249,0.45),0_8px_22px_rgba(8,47,73,0.55)] hover:!bg-[#083344] hover:!text-white [&_svg]:!text-[#ecfeff]",
      active &&
        "!border-[#ecfeff] !bg-[#22d3ee] !text-[#042f2e] hover:!bg-[#67e8f9] [&_svg]:!text-[#042f2e]",
    );
  }
  return cn(
    "border-zinc-400 bg-white text-[#1F2937] shadow-lg hover:bg-sky-50 hover:text-[#0f172a]",
    active &&
      "!border-[#0c4a6e] !bg-[#0284c7] !text-white hover:!bg-[#0369a1] [&_svg]:!text-white",
  );
}

export function mapModeChipClass(tone: MapControlTone) {
  if (tone === "dark") {
    return "!border-[#67e8f9] !bg-[#155e75] !text-[#ecfeff] hover:!bg-[#0e7490] [&_svg]:!text-[#ecfeff]";
  }
  return "border-[#111827] bg-zinc-800 text-white hover:bg-zinc-700 [&_svg]:!text-white";
}

export function mapStyleOptionClass(
  tone: MapControlTone,
  selected: boolean,
  pending: boolean,
) {
  if (tone === "dark") {
    return cn(
      "bg-[#0b1220]/90 text-[#e2e8f0] hover:bg-[#164e63]/80",
      selected && "bg-[#22d3ee] text-[#042f2e] ring-2 ring-[#ecfeff]",
      pending && "ring-1 ring-[#67e8f9]/70",
    );
  }
  if (tone === "satellite") {
    return cn(
      "border border-[#111827]/25 bg-white/94 text-[#1F2937] hover:bg-sky-50",
      selected &&
        "border-[#0c4a6e] bg-[#0369a1] text-white ring-2 ring-white hover:bg-[#0284c7]",
      pending && "ring-1 ring-[#0284c7]",
    );
  }
  return cn(
    "border border-zinc-300 bg-white text-[#1F2937] hover:bg-sky-50",
    selected &&
      "border-[#0c4a6e] bg-[#0284c7] text-white ring-2 ring-[#0c4a6e] hover:bg-[#0369a1]",
    pending && "ring-1 ring-[#0284c7]/70",
  );
}
