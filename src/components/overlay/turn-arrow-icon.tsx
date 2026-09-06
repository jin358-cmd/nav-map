"use client";

import type { ReactNode } from "react";
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
  variant = "curve",
}: {
  side: TurnSide;
  className?: string;
  variant?: "curve" | "sign";
}) {
  if (variant === "sign") {
    return <SignTurnArrow side={side} className={className} />;
  }
  if (side === "left") return <BendArrow kind="left" className={className} />;
  if (side === "right") return <BendArrow kind="right" className={className} />;
  if (side === "slight-left") return <SlightArrow kind="left" className={className} />;
  if (side === "slight-right") return <SlightArrow kind="right" className={className} />;
  if (side === "sharp-left") return <SharpArrow kind="left" className={className} />;
  if (side === "sharp-right") return <SharpArrow kind="right" className={className} />;
  if (side === "ramp-left") return <RampArrow kind="left" className={className} />;
  if (side === "ramp-right") return <RampArrow kind="right" className={className} />;
  if (side === "fork-left") return <ForkArrow kind="left" className={className} />;
  if (side === "fork-right") return <ForkArrow kind="right" className={className} />;
  if (side === "uturn") return <UTurnArrow className={className} />;
  if (side === "roundabout") return <RoundaboutArrow className={className} />;
  if (side === "arrive") return <ArriveMark className={className} />;
  return <StraightArrow className={className} />;
}

function ArrowFrame({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-full", className)} aria-hidden="true">
      {children}
    </svg>
  );
}

function shaftProps() {
  return {
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 8.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

/** Forward, then a natural 90° bend — not a square L. */
function BendArrow({
  kind,
  className,
}: {
  kind: "left" | "right";
  className?: string;
}) {
  const left = kind === "left";
  return (
    <ArrowFrame className={className}>
      <path
        d={left ? "M33 56 C33 34 33 30 18 30" : "M31 56 C31 34 31 30 46 30"}
        {...shaftProps()}
      />
      <path
        d={left ? "M6 30 L20 18.5 L20 41.5 Z" : "M58 30 L44 18.5 L44 41.5 Z"}
        fill="currentColor"
      />
    </ArrowFrame>
  );
}

function SlightArrow({
  kind,
  className,
}: {
  kind: "left" | "right";
  className?: string;
}) {
  const left = kind === "left";
  return (
    <ArrowFrame className={className}>
      <path
        d={left ? "M32 56 C32 40 26 28 17 16" : "M32 56 C32 40 38 28 47 16"}
        {...shaftProps()}
      />
      <path
        d={
          left
            ? "M7 22 L22 9 L26 28 Z"
            : "M57 22 L42 9 L38 28 Z"
        }
        fill="currentColor"
      />
    </ArrowFrame>
  );
}

function SharpArrow({
  kind,
  className,
}: {
  kind: "left" | "right";
  className?: string;
}) {
  const left = kind === "left";
  return (
    <ArrowFrame className={className}>
      <path
        d={
          left
            ? "M36 56 C36 28 30 20 16 22 C10 24 10 32 12 40"
            : "M28 56 C28 28 34 20 48 22 C54 24 54 32 52 40"
        }
        {...shaftProps()}
      />
      <path
        d={left ? "M12 52 L4 36 L24 38 Z" : "M52 52 L60 36 L40 38 Z"}
        fill="currentColor"
      />
    </ArrowFrame>
  );
}

function RampArrow({
  kind,
  className,
}: {
  kind: "left" | "right";
  className?: string;
}) {
  const left = kind === "left";
  return (
    <ArrowFrame className={className}>
      <path d="M32 56 V14" {...shaftProps()} strokeWidth={7} />
      <path
        d={left ? "M32 36 C26 28 20 22 14 16" : "M32 36 C38 28 44 22 50 16"}
        {...shaftProps()}
        strokeWidth={7.5}
      />
      <path
        d={left ? "M5 20 L20 8 L24 26 Z" : "M59 20 L44 8 L40 26 Z"}
        fill="currentColor"
      />
    </ArrowFrame>
  );
}

function ForkArrow({
  kind,
  className,
}: {
  kind: "left" | "right";
  className?: string;
}) {
  const left = kind === "left";
  return (
    <ArrowFrame className={className}>
      <path d="M32 56 V38" {...shaftProps()} strokeWidth={7.5} />
      <path
        d="M32 38 C40 30 46 22 50 16"
        {...shaftProps()}
        strokeWidth={7}
        opacity={left ? 0.32 : 1}
      />
      <path
        d="M32 38 C24 30 18 22 14 16"
        {...shaftProps()}
        strokeWidth={7}
        opacity={left ? 1 : 0.32}
      />
      <path
        d={left ? "M4 20 L19 8 L23 26 Z" : "M60 20 L45 8 L41 26 Z"}
        fill="currentColor"
      />
    </ArrowFrame>
  );
}

function StraightArrow({ className }: { className?: string }) {
  return (
    <ArrowFrame className={className}>
      <path d="M32 56 V20" {...shaftProps()} />
      <path d="M32 6 L18 24 L46 24 Z" fill="currentColor" />
    </ArrowFrame>
  );
}

function UTurnArrow({ className }: { className?: string }) {
  return (
    <ArrowFrame className={className}>
      <path d="M22 56 V26 A10 10 0 0 1 42 26 V38" {...shaftProps()} />
      <path d="M42 52 L30 38 L54 38 Z" fill="currentColor" />
    </ArrowFrame>
  );
}

function RoundaboutArrow({ className }: { className?: string }) {
  return (
    <ArrowFrame className={className}>
      <circle
        cx="32"
        cy="36"
        r="11"
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
      />
      <path d="M32 56 V47" {...shaftProps()} strokeWidth={7} />
      <path d="M32 25 V16" {...shaftProps()} strokeWidth={7} />
      <path d="M32 6 L20 20 L44 20 Z" fill="currentColor" />
    </ArrowFrame>
  );
}

function ArriveMark({ className }: { className?: string }) {
  return (
    <ArrowFrame className={className}>
      <path
        d="M32 8 C20 8 12 18 12 28 C12 42 32 56 32 56 C32 56 52 42 52 28 C52 18 44 8 32 8 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="28" r="6" fill="currentColor" />
    </ArrowFrame>
  );
}

/** Filled highway-sign pictograms — distinct from the curved HUD strokes. */
function SignTurnArrow({
  side,
  className,
}: {
  side: TurnSide;
  className?: string;
}) {
  if (side === "left") return <SignBend kind="left" className={className} />;
  if (side === "right") return <SignBend kind="right" className={className} />;
  if (side === "slight-left") return <SignSlight kind="left" className={className} />;
  if (side === "slight-right") return <SignSlight kind="right" className={className} />;
  if (side === "sharp-left") return <SignSharp kind="left" className={className} />;
  if (side === "sharp-right") return <SignSharp kind="right" className={className} />;
  if (side === "ramp-left") return <SignRamp kind="left" className={className} />;
  if (side === "ramp-right") return <SignRamp kind="right" className={className} />;
  if (side === "fork-left") return <SignFork kind="left" className={className} />;
  if (side === "fork-right") return <SignFork kind="right" className={className} />;
  if (side === "uturn") return <SignUTurn className={className} />;
  if (side === "roundabout") return <SignRoundabout className={className} />;
  if (side === "arrive") return <SignArrive className={className} />;
  return <SignStraight className={className} />;
}

function SignStraight({ className }: { className?: string }) {
  return (
    <ArrowFrame className={className}>
      <path
        d="M32 4 L52 26 H40 V60 H24 V26 H12 Z"
        fill="currentColor"
      />
    </ArrowFrame>
  );
}

function SignBend({
  kind,
  className,
}: {
  kind: "left" | "right";
  className?: string;
}) {
  const left = kind === "left";
  return (
    <ArrowFrame className={className}>
      <path
        d={
          left
            ? "M40 60 V28 H18 L18 18 L4 32 L18 46 V36 H24 V60 Z"
            : "M24 60 V28 H46 L46 18 L60 32 L46 46 V36 H40 V60 Z"
        }
        fill="currentColor"
      />
    </ArrowFrame>
  );
}

function SignSlight({
  kind,
  className,
}: {
  kind: "left" | "right";
  className?: string;
}) {
  const left = kind === "left";
  return (
    <ArrowFrame className={className}>
      <path
        d={
          left
            ? "M36 60 L36 38 L22 22 L22 12 L6 26 L20 40 L28 32 L28 60 Z"
            : "M28 60 L28 38 L42 22 L42 12 L58 26 L44 40 L36 32 L36 60 Z"
        }
        fill="currentColor"
      />
    </ArrowFrame>
  );
}

function SignSharp({
  kind,
  className,
}: {
  kind: "left" | "right";
  className?: string;
}) {
  const left = kind === "left";
  return (
    <ArrowFrame className={className}>
      <path
        d={
          left
            ? "M40 60 V22 H20 L26 12 L6 22 L26 32 L20 28 H28 V60 Z"
            : "M24 60 V22 H44 L38 12 L58 22 L38 32 L44 28 H36 V60 Z"
        }
        fill="currentColor"
      />
    </ArrowFrame>
  );
}

function SignRamp({
  kind,
  className,
}: {
  kind: "left" | "right";
  className?: string;
}) {
  const left = kind === "left";
  return (
    <ArrowFrame className={className}>
      <path d="M38 60 H26 V18 H38 Z" fill="currentColor" opacity={0.38} />
      <path
        d={
          left
            ? "M32 42 L20 24 L20 14 L4 28 L20 42 L20 32 L28 42 Z"
            : "M32 42 L44 24 L44 14 L60 28 L44 42 L44 32 L36 42 Z"
        }
        fill="currentColor"
      />
    </ArrowFrame>
  );
}

function SignFork({
  kind,
  className,
}: {
  kind: "left" | "right";
  className?: string;
}) {
  const left = kind === "left";
  return (
    <ArrowFrame className={className}>
      <path d="M38 60 H26 V36 H38 Z" fill="currentColor" />
      <path
        d="M32 38 L48 18 L48 10 L62 26 L46 40 L46 30 Z"
        fill="currentColor"
        opacity={left ? 0.3 : 1}
      />
      <path
        d="M32 38 L16 18 L16 10 L2 26 L18 40 L18 30 Z"
        fill="currentColor"
        opacity={left ? 1 : 0.3}
      />
    </ArrowFrame>
  );
}

function SignUTurn({ className }: { className?: string }) {
  return (
    <ArrowFrame className={className}>
      <path
        d="M18 60 V26 A14 14 0 0 1 46 26 V40 H36 L50 56 L64 40 H54 V26 A22 22 0 0 0 10 26 V60 Z"
        fill="currentColor"
      />
    </ArrowFrame>
  );
}

function SignRoundabout({ className }: { className?: string }) {
  return (
    <ArrowFrame className={className}>
      <circle
        cx="32"
        cy="36"
        r="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
      />
      <path d="M38 60 H26 V48 H38 Z" fill="currentColor" />
      <path d="M32 4 L46 20 H18 Z" fill="currentColor" />
    </ArrowFrame>
  );
}

function SignArrive({ className }: { className?: string }) {
  return (
    <ArrowFrame className={className}>
      <ellipse cx="32" cy="58" rx="10" ry="3.2" fill="#7f1d1d" opacity="0.35" />
      <path
        d="M32 6 C20 6 12 16 12 27 C12 42 32 58 32 58 C32 58 52 42 52 27 C52 16 44 6 32 6 Z"
        fill="#dc2626"
      />
      <path
        d="M32 6 C24 6 16 15 16 27 C16 38 32 52 32 52 C32 52 28 40 28 27 C28 16 32 8 32 6 Z"
        fill="#ef4444"
      />
      <circle cx="32" cy="26" r="7" fill="#fff" />
      <circle cx="32" cy="26" r="3.2" fill="#dc2626" />
    </ArrowFrame>
  );
}
