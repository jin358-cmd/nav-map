"use client";

import type { MouseEvent } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function HudCloseButton({
  label,
  onClick,
  className,
  size = "md",
  title,
}: {
  label: string;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      onClick={onClick}
      className={cn(
        "hud-window-close touch-manipulation",
        size === "sm" && "hud-window-close--sm",
        size === "lg" && "hud-window-close--lg",
        className,
      )}
    >
      <X strokeWidth={2.35} />
    </button>
  );
}
