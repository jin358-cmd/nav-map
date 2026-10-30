"use client";

import { cn } from "@/lib/utils";
import type { GuidanceArrowMode } from "@/lib/guidance-arrow-mode";

const OPTIONS: Array<{ id: GuidanceArrowMode; label: string }> = [
  { id: "flat", label: "平面" },
  { id: "float", label: "立體" },
];

export function GuidanceArrowToggle({
  mode,
  onChange,
}: {
  mode: GuidanceArrowMode;
  onChange: (mode: GuidanceArrowMode) => void;
}) {
  return (
    <div className="guidance-arrow-toggle" role="group" aria-label="導航箭頭樣式">
      {OPTIONS.map((option) => {
        const selected = mode === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.id)}
            className={cn(
              "guidance-arrow-toggle__option touch-manipulation",
              selected && "guidance-arrow-toggle__option--on",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
