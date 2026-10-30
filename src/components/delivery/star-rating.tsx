"use client";

import type { CourierRatingSummary } from "@/lib/delivery/types";

export function StarReadout({ rating }: { rating: CourierRatingSummary }) {
  if (rating.count <= 0 || rating.average == null) {
    return (
      <p className="text-[12px] text-zinc-400" data-testid="courier-stars">
        尚無評價
      </p>
    );
  }
  const rounded = Math.max(1, Math.min(5, Math.round(rating.average)));
  return (
    <p
      className="text-[12px] text-amber-200"
      data-testid="courier-stars"
      aria-label={`評價 ${rating.average.toFixed(1)} 分，${rating.count} 則`}
    >
      <span aria-hidden>{"★".repeat(rounded)}{"☆".repeat(5 - rounded)}</span>
      {` ${rating.average.toFixed(1)}（${rating.count}）`}
    </p>
  );
}

export function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (stars: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="外送員評分">
      {[1, 2, 3, 4, 5].map((stars) => (
        <button
          key={stars}
          type="button"
          role="radio"
          aria-checked={value === stars}
          aria-label={`${stars} 顆星`}
          data-testid={`rate-star-${stars}`}
          className="grid h-11 w-11 place-items-center rounded-xl border border-amber-300/40 text-xl text-amber-200"
          onClick={() => onChange(stars)}
        >
          {stars <= value ? "★" : "☆"}
        </button>
      ))}
    </div>
  );
}
