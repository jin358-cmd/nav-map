"use client";

import { cn } from "@/lib/utils";
import type { RouteStep } from "@/types/domain";

export type TurnSide =
  | "left"
  | "right"
  | "slight-left"
  | "slight-right"
  | "sharp-left"
  | "sharp-right"
  | "uturn"
  | "roundabout"
  | "arrive"
  | "straight"
  | "ramp-left"
  | "ramp-right"
  | "fork-left"
  | "fork-right";

export function turnSideFromStep(step: RouteStep | null): TurnSide {
  const type = (step?.type ?? "").toLowerCase();
  const modifier = (step?.modifier ?? "").toLowerCase();
  const action = (step?.action ?? "").toLowerCase();
  const blob = `${type} ${modifier} ${action}`;

  if (type === "arrive" || blob.includes("arrive") || blob.includes("抵達")) {
    return "arrive";
  }
  if (
    type.includes("roundabout") ||
    type.includes("rotary") ||
    blob.includes("圓環")
  ) {
    return "roundabout";
  }
  if (
    modifier.includes("uturn") ||
    type.includes("uturn") ||
    type.includes("u-turn") ||
    blob.includes("迴轉") ||
    blob.includes("回轉")
  ) {
    return "uturn";
  }

  const left = modifier.includes("left") || blob.includes("左");
  const right = modifier.includes("right") || blob.includes("右");

  if (type.includes("fork") || blob.includes("岔路") || blob.includes("分叉")) {
    if (left) return "fork-left";
    if (right) return "fork-right";
    return "fork-right";
  }
  if (
    type.includes("ramp") ||
    type.includes("on_ramp") ||
    type.includes("off_ramp") ||
    type.includes("on-ramp") ||
    type.includes("off-ramp") ||
    blob.includes("匝道")
  ) {
    if (left) return "ramp-left";
    if (right) return "ramp-right";
    return "slight-right";
  }
  if (modifier.includes("sharp") || blob.includes("急轉") || blob.includes("大彎")) {
    if (left) return "sharp-left";
    if (right) return "sharp-right";
  }
  if (
    modifier.includes("slight") ||
    modifier.includes("bear") ||
    blob.includes("微") ||
    blob.includes("偏")
  ) {
    if (left) return "slight-left";
    if (right) return "slight-right";
  }
  if (left) return "left";
  if (right) return "right";
  return "straight";
}

export function TurnArrowIcon({
  side,
  className,
}: {
  side: TurnSide;
  className?: string;
}) {
  if (side === "left") return <TurnArrow kind="left" className={className} />;
  if (side === "right") return <TurnArrow kind="right" className={className} />;
  if (side === "slight-left") return <SlightArrow direction="left" className={className} />;
  if (side === "slight-right") return <SlightArrow direction="right" className={className} />;
  if (side === "sharp-left") return <SharpArrow direction="left" className={className} />;
  if (side === "sharp-right") return <SharpArrow direction="right" className={className} />;
  if (side === "ramp-left") return <RampArrow direction="left" className={className} />;
  if (side === "ramp-right") return <RampArrow direction="right" className={className} />;
  if (side === "fork-left") return <ForkArrow direction="left" className={className} />;
  if (side === "fork-right") return <ForkArrow direction="right" className={className} />;
  if (side === "uturn") return <UTurnArrow className={className} />;
  if (side === "roundabout") return <RoundaboutArrow className={className} />;
  if (side === "arrive") return <ArriveMark className={className} />;
  return <StraightArrow className={className} />;
}

function TurnArrow({
  kind,
  className,
}: {
  kind: "left" | "right";
  className?: string;
}) {
  const left = kind === "left";
  return (
    <svg viewBox="0 0 64 64" className={cn("size-full", className)} aria-hidden="true">
      <path
        d={left ? "M32 56 V26 H16" : "M32 56 V26 H48"}
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={left ? "M28 16 L12 26 L28 36" : "M36 16 L52 26 L36 36"}
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SlightArrow({
  direction,
  className,
}: {
  direction: "left" | "right";
  className?: string;
}) {
  const left = direction === "left";
  return (
    <svg viewBox="0 0 64 64" className={cn("size-full", className)} aria-hidden="true">
      <path
        d={left ? "M32 56 V36 L18 18" : "M32 56 V36 L46 18"}
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={left ? "M10 28 L16 14 L30 20" : "M54 28 L48 14 L34 20"}
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SharpArrow({
  direction,
  className,
}: {
  direction: "left" | "right";
  className?: string;
}) {
  const left = direction === "left";
  return (
    <svg viewBox="0 0 64 64" className={cn("size-full", className)} aria-hidden="true">
      <path
        d={left ? "M36 56 V22 H18 V36" : "M28 56 V22 H46 V36"}
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={left ? "M8 28 L18 40 L28 28" : "M56 28 L46 40 L36 28"}
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RampArrow({
  direction,
  className,
}: {
  direction: "left" | "right";
  className?: string;
}) {
  const left = direction === "left";
  return (
    <svg viewBox="0 0 64 64" className={cn("size-full", className)} aria-hidden="true">
      <path
        d="M32 56 V12"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d={left ? "M32 34 L16 18" : "M32 34 L48 18"}
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d={left ? "M8 26 L14 12 L28 18" : "M56 26 L50 12 L36 18"}
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ForkArrow({
  direction,
  className,
}: {
  direction: "left" | "right";
  className?: string;
}) {
  const left = direction === "left";
  return (
    <svg viewBox="0 0 64 64" className={cn("size-full", className)} aria-hidden="true">
      <path
        d="M32 56 V36"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M32 36 L46 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        opacity={left ? 0.38 : 1}
      />
      <path
        d="M32 36 L18 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        opacity={left ? 1 : 0.38}
      />
      <path
        d={left ? "M8 24 L16 10 L30 18" : "M56 24 L48 10 L34 18"}
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StraightArrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-full", className)} aria-hidden="true">
      <path
        d="M32 56 V16"
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d="M18 28 L32 12 L46 28"
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UTurnArrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-full", className)} aria-hidden="true">
      <path
        d="M22 56 V24 a10 10 0 0 1 20 0 V40"
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d="M32 30 L42 44 L52 30"
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RoundaboutArrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-full", className)} aria-hidden="true">
      <circle
        cx="32"
        cy="34"
        r="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
      />
      <path
        d="M32 56 V46"
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M32 22 V10"
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M22 18 L32 6 L42 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
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
        strokeWidth="7"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="28" r="6" fill="currentColor" />
    </svg>
  );
}
