"use client";

import { cn } from "@/lib/utils";
import type { RouteStep } from "@/types/domain";

export type TurnSide = "left" | "right" | "uturn" | "roundabout" | "arrive" | "straight";

export function turnSideFromStep(step: RouteStep | null): TurnSide {
  const type = step?.type ?? "";
  const modifier = (step?.modifier ?? "").toLowerCase();
  if (type === "arrive") return "arrive";
  if (type.includes("roundabout") || type.includes("rotary")) return "roundabout";
  if (modifier.includes("uturn")) return "uturn";
  if (modifier.includes("left")) return "left";
  if (modifier.includes("right")) return "right";
  return "straight";
}

export function TurnArrowIcon({
  side,
  className,
}: {
  side: TurnSide;
  className?: string;
}) {
  if (side === "left") return <LTurnArrow direction="left" className={className} />;
  if (side === "right") return <LTurnArrow direction="right" className={className} />;
  if (side === "uturn") return <UTurnArrow className={className} />;
  if (side === "roundabout") return <RoundaboutArrow className={className} />;
  if (side === "arrive") return <ArriveMark className={className} />;
  return <StraightArrow className={className} />;
}

function LTurnArrow({
  direction,
  className,
}: {
  direction: "left" | "right";
  className?: string;
}) {
  const right = direction === "right";
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("size-full", className)}
      aria-hidden="true"
    >
      <path
        d={
          right
            ? "M20 8 V38 H46"
            : "M44 8 V38 H18"
        }
        fill="none"
        stroke="currentColor"
        strokeWidth="10"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <path
        d={right ? "M34 26 L50 38 L34 50" : "M30 26 L14 38 L30 50"}
        fill="none"
        stroke="currentColor"
        strokeWidth="10"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

function StraightArrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-full", className)} aria-hidden="true">
      <path
        d="M32 54 V16"
        fill="none"
        stroke="currentColor"
        strokeWidth="10"
        strokeLinecap="square"
      />
      <path
        d="M16 28 L32 10 L48 28"
        fill="none"
        stroke="currentColor"
        strokeWidth="10"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

function UTurnArrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-full", className)} aria-hidden="true">
      <path
        d="M18 54 V26 a14 14 0 0 1 28 0 V40"
        fill="none"
        stroke="currentColor"
        strokeWidth="10"
        strokeLinecap="square"
      />
      <path
        d="M36 28 L46 42 L56 28"
        fill="none"
        stroke="currentColor"
        strokeWidth="10"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

function RoundaboutArrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-full", className)} aria-hidden="true">
      <circle
        cx="32"
        cy="32"
        r="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
      />
      <path
        d="M32 8 V20"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="square"
      />
      <path
        d="M22 16 L32 6 L42 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

function ArriveMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-full", className)} aria-hidden="true">
      <path
        d="M32 8 C20 8 12 18 12 28 C12 42 32 56 32 56 C32 56 52 42 52 28 C52 18 44 8 32 8 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="28" r="6" fill="currentColor" />
    </svg>
  );
}
