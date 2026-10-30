"use client";

import { useState } from "react";
import { HudCloseButton } from "@/components/overlay/hud-close-button";
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

function lineClass(kind: PreviewPolyline["kind"]) {
  if (kind === "depart") return "route-preview-card__depart";
  if (kind === "context") return "route-preview-card__context";
  if (kind === "approach") return "route-preview-card__approach";
  return "route-preview-card__route";
}

export function RoutePreviewCard({
  navigating,
  phase,
  route,
  routeMeters,
  turnCueMeters,
  roads,
}: {
  navigating: boolean;
  phase: NavAutoZoomPhase;
  route: [number, number][];
  routeMeters: number;
  turnCueMeters: number[];
  roads: RoadSketch[];
}) {
  const [minimised, setMinimised] = useState(false);
  if (!navigating || route.length < 2) return null;

  const mode = previewModeForPhase(phase);
  const apex = activeTurnApex(turnCueMeters, routeMeters);
  const scene =
    mode === "junction" && apex != null
      ? buildJunctionScene(
          route,
          routeMeters,
          apex,
          roads.map((road) => road.line),
        )
      : buildOverviewScene(route, routeMeters, roads);

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
    <section className="route-preview-card" aria-label={mode === "junction" ? "路口放大預覽" : "全程路線預覽"}>
      <header className="route-preview-card__bar">
        <p>{mode === "junction" ? "路口" : "全程"}</p>
        <HudCloseButton label="收合路線預覽" size="sm" onClick={() => setMinimised(true)} />
      </header>
      <svg
        className="route-preview-card__svg"
        viewBox={`0 0 ${scene.width} ${scene.height}`}
        role="img"
      >
        <title>{mode === "junction" ? "下一個路口" : "全程路線"}</title>
        <rect width={scene.width} height={scene.height} fill="#1e293b" />
        {scene.lines.map((line, index) => (
          <path key={`${line.kind}-${index}`} className={lineClass(line.kind)} d={pointsToPath(line.points)} />
        ))}
        {scene.markers.map((marker) => (
          <circle
            key={marker.kind}
            className={
              marker.kind === "position"
                ? "route-preview-card__position"
                : marker.kind === "maneuver"
                  ? "route-preview-card__maneuver"
                  : "route-preview-card__destination"
            }
            cx={marker.at.x}
            cy={marker.at.y}
            r={marker.kind === "position" ? 4.5 : 3.6}
          />
        ))}
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
    </section>
  );
}
