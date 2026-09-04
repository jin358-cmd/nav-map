"use client";

import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  onChange,
  open,
  onToggle,
}: {
  mode: MapDisplayMode;
  onChange: (mode: MapDisplayMode) => void;
  open: boolean;
  onToggle: () => void;
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
          "size-12 rounded-2xl border-zinc-500/55 bg-zinc-800/92 text-zinc-100 shadow-lg backdrop-blur-md hover:bg-zinc-700 disabled:border-zinc-700 disabled:bg-zinc-900/80 disabled:text-zinc-500",
          open && "border-cyan-300/80 bg-zinc-700 text-cyan-200",
        )}
      >
        <Layers className="size-5" />
      </Button>
      {open ? (
        <div className="absolute top-0 right-14 z-50 flex flex-col gap-1 rounded-2xl border border-white/12 bg-black/80 p-1.5 shadow-xl backdrop-blur-xl">
          {OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={cn(
                "h-9 min-w-16 rounded-xl px-3 text-left text-sm",
                mode === option.id
                  ? "bg-zinc-700 text-cyan-200 ring-1 ring-cyan-300/70"
                  : "bg-zinc-800/80 text-zinc-200 hover:bg-zinc-700",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
