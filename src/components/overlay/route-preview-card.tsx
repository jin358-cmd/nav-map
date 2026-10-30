"use client";

import { useState } from "react";
import { HudCloseButton } from "@/components/overlay/hud-close-button";
import { TurnArrowIcon, turnSideFromStep } from "@/components/overlay/turn-arrow-icon";
import { formatDistance } from "@/lib/format";
import type { RoadSketch } from "@/lib/junction-roads";
import type { NavAutoZoomPhase } from "@/lib/nav-auto-zoom";
import {
  activeTurnApex,
  buildJunctionScene,
  buildOverviewScene,
  previewModeForPhase,
  pointsToPath,
  type PreviewPolyline,
} from "@/lib/route-preview-geometry";
import type { RouteStep } from "@/types/domain";

function roadRibbon(
  points: { x: number; y: number }[],
  nearWidth: number,
  farWidth: number,
) {
  if (points.length < 2) return "";
  const left: string[] = [];
  const right: string[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const t = index / (points.length - 1);
    const width = (nearWidth + (farWidth - nearWidth) * t) / 2;
    const prev = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const angle = Math.atan2(next.y - prev.y, next.x - prev.x);
    const nx = Math.sin(angle);
    const ny = -Math.cos(angle);
    const point = points[index];
    left.push(`${(point.x + nx * width).toFixed(1)},${(point.y + ny * width).toFixed(1)}`);
    right.push(`${(point.x - nx * width).toFixed(1)},${(point.y - ny * width).toFixed(1)}`);
  }
  return `M${left.join(" L")} L${right.reverse().join(" L")} Z`;
}

function lineClass(kind: PreviewPolyline["kind"]) {
  if (kind === "depart") return "route-preview-card__depart";
  if (kind === "major") return "route-preview-card__major";
  if (kind === "context") return "route-preview-card__context";
  if (kind === "approach") return "route-preview-card__approach";
  return "route-preview-card__route";
}

function namesForApex(steps: RouteStep[], apex: number | null) {
  if (apex == null) return { approach: null as RouteStep | null, exit: null as RouteStep | null, then: null as RouteStep | null };
  const exitIndex = steps.findIndex((step) => Math.abs(step.cueMeters - apex) < 45);
  const exit = exitIndex >= 0 ? steps[exitIndex] : null;
  const approach = [...steps].reverse().find((step) => step.cueMeters < apex - 8) ?? null;
  const then = exitIndex >= 0 ? steps[exitIndex + 1] ?? null : null;
  return { approach, exit, then };
}

function laneGuidance(step: RouteStep | null): Array<{ active: boolean }> | null {
  const lanes = (step as (RouteStep & { lanes?: unknown }) | null)?.lanes;
  if (!Array.isArray(lanes) || lanes.length === 0) return null;
  const parsed = lanes.flatMap((lane) => {
    if (!lane || typeof lane !== "object") return [];
    const active = Boolean((lane as { active?: boolean }).active);
    return [{ active }];
  });
  return parsed.length ? parsed : null;
}

export function RoutePreviewCard({
  navigating,
  phase,
  route,
  routeMeters,
  turnCueMeters,
  roads,
  blocks = [],
  steps = [],
  distanceMeters = null,
}: {
  navigating: boolean;
  phase: NavAutoZoomPhase;
  route: [number, number][];
  routeMeters: number;
  turnCueMeters: number[];
  roads: RoadSketch[];
  blocks?: [number, number][][];
  steps?: RouteStep[];
  distanceMeters?: number | null;
}) {
  const [minimised, setMinimised] = useState(false);
  if (!navigating || route.length < 2) return null;

  const mode = previewModeForPhase(phase);
  const apex = activeTurnApex(turnCueMeters, routeMeters);
  const named = namesForApex(steps, apex);
  const names = {
    approach: named.approach?.roadName || "",
    exit: named.exit?.roadName || "",
  };
  const scene =
    mode === "junction" && apex != null
      ? buildJunctionScene(route, routeMeters, apex, roads, names, blocks)
      : buildOverviewScene(route, routeMeters, roads);
  const close = distanceMeters != null && distanceMeters < 30;
  const distance =
    distanceMeters != null && Number.isFinite(distanceMeters)
      ? close
        ? "現在"
        : formatDistance(Math.max(0, distanceMeters))
      : "";
  const lanes = laneGuidance(named.exit);
  const junction = mode === "junction";

  if (minimised) {
    return (
      <button
        type="button"
        className="route-preview-restore touch-manipulation"
        onClick={() => setMinimised(false)}
      >
        路線預覽
      </button>
    );
  }

  return (
    <section
      className={junction ? "route-preview-card junction-diagram" : "route-preview-card"}
      aria-label={junction ? "路口放大預覽" : "全程路線預覽"}
    >
      <header className={junction ? "junction-diagram__bar" : "route-preview-card__bar"}>
        {junction ? (
          <>
            <span className="junction-diagram__badge">
              <TurnArrowIcon side={turnSideFromStep(named.exit)} className="junction-diagram__badge-icon" />
            </span>
            <span className="junction-diagram__distance">{distance || "路口"}</span>
            <span className="junction-diagram__road">{names.exit || names.approach || "前方路口"}</span>
            {named.then ? (
              <span className="junction-diagram__then">
                然後
                <TurnArrowIcon side={turnSideFromStep(named.then)} className="junction-diagram__then-icon" />
              </span>
            ) : null}
          </>
        ) : (
          <p>
            全程
            {distance ? <span className="route-preview-card__distance">{distance}</span> : null}
          </p>
        )}
        <HudCloseButton label="收合路線預覽" size="sm" onClick={() => setMinimised(true)} />
      </header>
      <svg
        className="route-preview-card__svg"
        viewBox={`0 0 ${scene.width} ${scene.height}`}
        role="img"
        shapeRendering="geometricPrecision"
      >
        <title>{mode === "junction" ? "下一個路口" : "全程路線"}</title>
        <rect width={scene.width} height={scene.height} fill={junction ? "#8ed18a" : "#243044"} />
        {scene.blocks.map((ring, index) => (
          <path key={`block-${index}`} className="route-preview-card__block" d={`${pointsToPath(ring)} Z`} />
        ))}
        {scene.lines
          .filter((line) => !(junction && line.kind === "route"))
          .map((line, index) => (
          <path
            key={`${line.kind}-case-${index}`}
            className={
              line.kind === "major"
                ? "route-preview-card__major-case"
                : line.kind === "context"
                  ? "route-preview-card__context-case"
                  : "route-preview-card__route-case"
            }
            d={pointsToPath(line.points)}
          />
        ))}
        {scene.lines.filter((line) => line.kind !== "route").map((line, index) =>
          junction && line.kind === "approach" ? (
            <path
              key={`${line.kind}-${index}`}
              className="junction-diagram__asphalt junction-diagram__asphalt--approach"
              d={roadRibbon(line.points, 36, 22)}
            />
          ) : (
            <path
              key={`${line.kind}-${index}`}
              className={junction ? `junction-diagram__asphalt junction-diagram__asphalt--${line.kind}` : lineClass(line.kind)}
              d={pointsToPath(line.points)}
            />
          ),
        )}
        {junction
          ? scene.lines
              .filter((line) => line.kind !== "route")
              .map((line, index) => (
              <path
                key={`${line.kind}-lane-${index}`}
                className="junction-diagram__lane"
                d={pointsToPath(line.points)}
              />
            ))
          : null}
        {junction
          ? scene.lines
              .filter((line) => line.kind === "route")
              .map((line, index) => (
                <path
                  key={`route-${index}`}
                  className="junction-diagram__route"
                  d={pointsToPath(line.points)}
                />
              ))
          : null}
        {scene.arrow.length === 3 ? (
          <path
            className={junction ? "junction-diagram__arrow" : "route-preview-card__arrow"}
            d={`${pointsToPath(scene.arrow)} Z`}
          />
        ) : null}
        {scene.markers.map((marker) =>
          marker.kind === "position" ? (
            junction ? (
              <g
                key="car"
                className="junction-diagram__car"
                transform={`translate(${marker.at.x} ${marker.at.y}) rotate(${marker.heading ?? 0})`}
              >
                <circle r="8" />
                <polygon points="0,-6 4.4,6 -4.4,6" />
              </g>
            ) : (
              <polygon
                key="car"
                className="route-preview-card__position"
                points="0,-7 5.2,6 -5.2,6"
                transform={`translate(${marker.at.x} ${marker.at.y}) rotate(${marker.heading ?? 0})`}
              />
            )
          ) : (
            <circle
              key={marker.kind}
              className={
                marker.kind === "maneuver"
                  ? "route-preview-card__maneuver"
                  : "route-preview-card__destination"
              }
              cx={marker.at.x}
              cy={marker.at.y}
              r={3.4}
            />
          ),
        )}
        <g
          className="route-preview-card__north"
          transform={`translate(${scene.width - 18} 18) rotate(${scene.northDeg})`}
        >
          <polygon points="0,-7 2.4,4 -2.4,4" />
          <text y="-8" textAnchor="middle">北</text>
        </g>
        {scene.labels.map((label) => (
          <text
            key={`${label.text}-${label.at.x.toFixed(1)}`}
            x={label.at.x}
            y={label.at.y}
            className="route-preview-card__label"
            textAnchor="middle"
          >
            {label.text}
          </text>
        ))}
      </svg>
      {junction && lanes ? (
        <div className="junction-diagram__lanes" aria-label="車道">
          {lanes.map((lane, index) => (
            <span key={index} className={lane.active ? "is-active" : undefined}>
              ↑
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
