"use client";

import { HEADING_REFERENCE_HALF_DEG } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { FollowOrientation } from "@/types/domain";

export function HeadingCompass({
  heading,
  orientation,
  onClick,
  className,
}: {
  heading: number;
  orientation: FollowOrientation;
  onClick: () => void;
  className?: string;
}) {
  const headingUp = orientation === "heading-up";
  const roseRotation = headingUp ? -heading : 0;
  const headingRotation = headingUp ? 0 : heading;
  const half = HEADING_REFERENCE_HALF_DEG;

  return (
    <button
      type="button"
      onClick={onClick}
      title="方向參考範圍為視覺輔助，不是 GPS 誤差"
      aria-label="回到定位並顯示方向參考範圍"
      className={cn(
        "relative flex size-12 items-center justify-center rounded-full border border-[#111827]/55 bg-white/94 text-[#1F2937] shadow-lg backdrop-blur-md touch-manipulation",
        className,
      )}
    >
      <svg viewBox="0 0 64 64" className="size-10" aria-hidden="true">
        <circle
          cx="32"
          cy="32"
          r="29"
          fill="none"
          stroke="rgba(31,41,55,0.28)"
          strokeWidth="1.5"
        />
        <g
          transform={`rotate(${headingRotation} 32 32)`}
          style={{ transition: "transform 180ms linear" }}
        >
          <path
            d={headingRangePath(32, 32, 27, half)}
            fill="rgba(148, 163, 184, 0.18)"
            stroke="rgba(191, 219, 254, 0.28)"
            strokeWidth="1"
          />
          <line
            x1="32"
            y1="32"
            x2="32"
            y2="10"
            stroke="#111827"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <polygon points="32,7 36,14 32,12 28,14" fill="#111827" />
        </g>
        <g
          transform={`rotate(${roseRotation} 32 32)`}
          style={{ transition: "transform 180ms linear" }}
        >
          <polygon points="32,8 36,24 32,21 28,24" fill="#ef4444" />
          <polygon points="32,56 36,40 32,43 28,40" fill="#f8fafc" />
          <text
            x="32"
            y="18"
            textAnchor="middle"
            fill="#fecaca"
            fontSize="8"
            fontWeight="700"
          >
            N
          </text>
        </g>
      </svg>
    </button>
  );
}

function headingRangePath(cx: number, cy: number, radius: number, halfDeg: number) {
  const rad = (halfDeg * Math.PI) / 180;
  const left = {
    x: cx - radius * Math.sin(rad),
    y: cy - radius * Math.cos(rad),
  };
  const right = {
    x: cx + radius * Math.sin(rad),
    y: cy - radius * Math.cos(rad),
  };
  return `M ${cx} ${cy} L ${left.x} ${left.y} A ${radius} ${radius} 0 0 1 ${right.x} ${right.y} Z`;
}
