"use client";

import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  mapControlButtonClass,
  mapStyleOptionClass,
  type MapControlTone,
} from "@/lib/map-control-tone";
import { cn } from "@/lib/utils";
import type { MapDisplayMode } from "@/types/domain";

const OPTIONS: Array<{ id: MapDisplayMode; label: string }> = [
  { id: "light", label: "白天" },
  { id: "dark", label: "夜間" },
  { id: "auto", label: "自動" },
  { id: "satellite", label: "衛星" },
];

export function MapStyleMenu({
  mode,
  pendingMode = null,
  onChange,
  open,
  onToggle,
  tone,
}: {
  mode: MapDisplayMode;
  pendingMode?: MapDisplayMode | null;
  onChange: (mode: MapDisplayMode) => void;
  open: boolean;
  onToggle: () => void;
  tone: MapControlTone;
}) {
  return (
    <div className="map-style-menu relative">
      <div
        id="navpilot-map-style"
        role="listbox"
        aria-label="地圖顯示模式"
        aria-hidden={!open}
        className={cn(
          "map-style-flyout flex flex-col gap-1 rounded-2xl border p-1.5 shadow-xl backdrop-blur-xl",
          tone === "light"
            ? "border-zinc-300/70 bg-white/90"
            : "border-white/12 bg-black/80",
          !open && "map-style-flyout--closed",
        )}
      >
        {OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="option"
            aria-selected={mode === option.id}
            onClick={() => onChange(option.id)}
            className={cn(
              "map-style-option flex h-9 min-w-16 items-center justify-center rounded-xl px-3 text-center text-sm touch-manipulation",
              option.id === "auto" && "map-style-option--auto",
              mapStyleOptionClass(
                tone,
                mode === option.id,
                pendingMode === option.id,
              ),
            )}
          >
            {option.label}
            {pendingMode === option.id ? "…" : ""}
          </button>
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label="地圖顯示模式"
        title="地圖顯示模式"
        aria-expanded={open}
        aria-controls="navpilot-map-style"
        onClick={onToggle}
        className={cn(
          "relative z-10 size-12 rounded-full backdrop-blur-md disabled:border-zinc-700 disabled:bg-zinc-900/80 disabled:text-zinc-500 touch-manipulation",
          mapControlButtonClass(tone, open),
        )}
      >
        <Layers className="size-6" strokeWidth={2.5} />
      </Button>
    </div>
  );
}
