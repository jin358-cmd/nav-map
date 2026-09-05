"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MAP_DATA_SOURCES } from "@/lib/map-attribution";
import { mapControlTone } from "@/lib/map-control-tone";
import { cn } from "@/lib/utils";
import type { MapDisplayMode } from "@/types/domain";

export function MapAttribution({
  mapDisplayMode,
}: {
  mapDisplayMode: MapDisplayMode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogId = useId();
  const tone = mapControlTone(mapDisplayMode);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="hud-anchor-attrib pointer-events-auto">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={dialogId}
        aria-label="地圖資料來源與授權"
        title="資料來源"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex h-7 items-center gap-1 rounded-full border px-2 text-[10px] font-semibold tracking-wide touch-manipulation",
          tone === "light"
            ? "border-zinc-400/70 bg-white/80 text-[#3F3F46]"
            : tone === "satellite"
              ? "border-[#111827]/45 bg-white/82 text-[#3F3F46]"
              : "border-white/15 bg-black/35 text-zinc-200",
        )}
      >
        <span aria-hidden="true">©</span>
        <span>OSM</span>
      </button>
      {open ? (
        <div
          id={dialogId}
          role="dialog"
          aria-label="資料來源與授權"
          className="hud-attrib-panel"
        >
          <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-zinc-400">
            資料來源
          </p>
          <ul className="space-y-1.5">
            {MAP_DATA_SOURCES.map((entry) => (
              <li key={entry.href}>
                <a
                  href={entry.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-[12px] font-medium leading-snug text-zinc-100 underline-offset-2 hover:underline"
                >
                  {entry.label}
                </a>
                {entry.note ? (
                  <p className="text-[10px] leading-snug text-zinc-400">{entry.note}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
