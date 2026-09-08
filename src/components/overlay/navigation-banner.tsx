"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, X } from "lucide-react";
import { formatDistance } from "@/lib/format";
import {
  formatIntersectionLabel,
  formatTaiwanRoadName,
} from "@/lib/geocoding/format-taiwan-display-address";
import type { ManeuverAlertPhase } from "@/lib/maneuver-guidance";
import { cn } from "@/lib/utils";
import type { RouteStep } from "@/types/domain";

function useSmoothedMeters(target: number) {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);
  const lastTsRef = useRef<number | null>(null);

  useEffect(() => {
    let frame = 0;
    lastTsRef.current = null;
    const tick = (now: number) => {
      const next = target;
      const current = shownRef.current;
      if (!Number.isFinite(next)) {
        frame = requestAnimationFrame(tick);
        return;
      }
      const last = lastTsRef.current ?? now;
      lastTsRef.current = now;
      const dt = Math.min(0.08, Math.max(0, (now - last) / 1000));
      const jump = Math.abs(next - current);
      const blended =
        jump > 180 ? next : current + (next - current) * (1 - Math.exp(-dt / 0.32));
      shownRef.current = blended;
      const rounded = Math.round(blended);
      if (rounded !== Math.round(current)) {
        setShown(rounded);
      }
      if (Math.abs(next - blended) > 0.5) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return shown;
}

function shortTurn(step: RouteStep | null) {
  if (!step) return "繼續前行";
  if (step.type === "arrive") return "抵達";
  return step.action || "繼續前行";
}

function shortRoadName(step: RouteStep | null) {
  const raw = step?.roadName?.trim() ?? "";
  if (!raw) return step?.type === "arrive" ? "目的地" : "";
  const cleaned = formatIntersectionLabel(formatTaiwanRoadName(raw) || raw);
  if (cleaned.length <= 22) return cleaned;
  const road = cleaned.match(
    /[\u4e00-\u9fff0-9]+(?:路|街|道|巷|段|線|橋|大道)[^\s]{0,8}/,
  );
  return road?.[0] ?? cleaned.slice(0, 22);
}

function useLatchedStep(step: RouteStep | null) {
  const [shown, setShown] = useState(step);
  const shownIdRef = useRef(step?.id ?? "");

  useEffect(() => {
    const nextId = step?.id ?? "";
    if (nextId === shownIdRef.current) {
      setShown(step);
      return;
    }
    const timer = window.setTimeout(() => {
      shownIdRef.current = nextId;
      setShown(step);
    }, 480);
    return () => window.clearTimeout(timer);
  }, [step]);

  return shown;
}

export const NextIntersectionHud = forwardRef<
  HTMLDivElement,
  {
    step: RouteStep | null;
    distanceMeters: number;
    offRoute: boolean;
    rerouting?: boolean;
    reroutePending?: boolean;
    alertPhase?: ManeuverAlertPhase;
    isTurn?: boolean;
    onCancelNavigation?: () => void;
    voiceEnabled?: boolean;
    onToggleVoice?: () => void;
  }
>(function NextIntersectionHud(
  {
    step,
    distanceMeters,
    offRoute,
    rerouting = false,
    reroutePending = false,
    alertPhase = "cruise",
    isTurn = false,
    onCancelNavigation,
    voiceEnabled = true,
    onToggleVoice,
  },
  ref,
) {
  const latched = useLatchedStep(step);
  const turn = shortTurn(latched);
  const road = shortRoadName(latched);
  const displayMeters = useSmoothedMeters(distanceMeters);
  const headline = `${formatDistance(displayMeters)}後${turn}`;
  const turnAlert = isTurn && alertPhase !== "cruise";

  return (
    <div
      ref={ref}
      className={cn(
        "navigation-instruction-card pointer-events-none w-full min-w-0",
        turnAlert
          ? "navigation-instruction-card--alert"
          : "navigation-instruction-card--cruise",
      )}
    >
      {onCancelNavigation ? (
        <button
          type="button"
          onClick={onCancelNavigation}
          aria-label="取消導航"
          title="取消導航"
          className="navigation-card-cancel pointer-events-auto touch-manipulation"
        >
          <X className="size-3.5" strokeWidth={2.3} />
        </button>
      ) : null}
      <div className="navigation-instruction-content">
        <div className="navigation-copy min-w-0 text-left">
          <p className="navigation-guidance truncate tabular-nums tracking-tight">
            {headline}
          </p>
          {road ? <p className="navigation-road-name truncate">{road}</p> : null}
          {rerouting ? (
            <p className="navigation-status navigation-status--reroute truncate">
              {reroutePending ? "仍在重新規劃路線" : "正在重新規劃路線"}
            </p>
          ) : offRoute ? (
            <p className="navigation-status navigation-status--reroute truncate">
              偏離路線，即將重算
            </p>
          ) : null}
        </div>
      </div>
      {onToggleVoice ? (
        <button
          type="button"
          onClick={onToggleVoice}
          aria-pressed={voiceEnabled}
          aria-label={voiceEnabled ? "關閉導航語音" : "開啟導航語音"}
          title={voiceEnabled ? "關閉語音" : "開啟語音"}
          className="navigation-card-voice pointer-events-auto touch-manipulation"
        >
          {voiceEnabled ? (
            <Volume2 className="size-3.5" strokeWidth={2.1} />
          ) : (
            <VolumeX className="size-3.5" strokeWidth={2.1} />
          )}
        </button>
      ) : null}
    </div>
  );
});
