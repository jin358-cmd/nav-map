"use client";

import { formatForkComparison } from "@/lib/elevated-ground/copy";
import type { ForkRoute } from "@/lib/elevated-ground/types";

function ChoiceButton({
  title,
  current,
  detail,
  onClick,
}: {
  title: string;
  current: boolean;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={
        current
          ? "elevated-ground-choice__btn is-current"
          : "elevated-ground-choice__btn"
      }
      aria-pressed={current}
      aria-label={current ? `${title}，目前路線` : `${title}，${detail}`}
      onClick={onClick}
    >
      <span className="elevated-ground-choice__title">{title}</span>
      <span className="elevated-ground-choice__meta">{current ? "目前" : detail}</span>
    </button>
  );
}

export function ElevatedGroundChoice({
  active,
  elevated,
  ground,
  dismissMs,
  onChoose,
}: {
  active: "elevated" | "ground";
  elevated: ForkRoute;
  ground: ForkRoute;
  dismissMs: number;
  onChoose: (side: "elevated" | "ground") => void;
}) {
  const current = active === "elevated" ? elevated : ground;
  const elevatedDetail = formatForkComparison(
    current.durationSeconds,
    current.distanceMeters,
    elevated.durationSeconds,
    elevated.distanceMeters,
  );
  const groundDetail = formatForkComparison(
    current.durationSeconds,
    current.distanceMeters,
    ground.durationSeconds,
    ground.distanceMeters,
  );
  return (
    <section className="elevated-ground-choice" aria-label="高架或平面">
      <ChoiceButton
        title="走高架"
        current={active === "elevated"}
        detail={elevatedDetail}
        onClick={() => onChoose("elevated")}
      />
      <ChoiceButton
        title="走平面"
        current={active === "ground"}
        detail={groundDetail}
        onClick={() => onChoose("ground")}
      />
      <div
        className="elevated-ground-choice__timer"
        style={{ animationDuration: `${dismissMs}ms` }}
        aria-hidden="true"
      />
    </section>
  );
}
