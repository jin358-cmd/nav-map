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
        className="size-12 rounded-2xl border-white/12 bg-black/55 text-zinc-100 shadow-lg backdrop-blur-md hover:bg-black/70"
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
                  ? "bg-cyan-400/20 text-cyan-100"
                  : "text-zinc-200 hover:bg-white/8",
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
