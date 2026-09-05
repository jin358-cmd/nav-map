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
  { id: "light", label: "亮色" },
  { id: "dark", label: "暗色" },
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
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        aria-label="地圖顯示模式"
        title="地圖顯示模式"
        onClick={onToggle}
        className={cn(
          "size-12 rounded-2xl backdrop-blur-md disabled:border-zinc-700 disabled:bg-zinc-900/80 disabled:text-zinc-500",
          mapControlButtonClass(tone, open),
        )}
      >
        <Layers className="size-5" />
      </Button>
      {open ? (
        <div
          className={cn(
            "absolute top-0 right-14 z-50 flex flex-col gap-1 rounded-2xl border p-1.5 shadow-xl backdrop-blur-xl",
            tone === "light"
              ? "border-zinc-300/70 bg-white/90"
              : "border-white/12 bg-black/80",
          )}
        >
          {OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={cn(
                "h-9 min-w-16 rounded-xl px-3 text-left text-sm",
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
      ) : null}
    </div>
  );
}
