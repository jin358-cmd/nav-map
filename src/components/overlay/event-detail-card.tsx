"use client";

import { Navigation, X } from "lucide-react";
import {
  AccidentTriangleIcon,
  CongestionCarsIcon,
  ConstructionBarrierIcon,
  DisasterWarningIcon,
} from "@/components/overlay/status-icons";
import { Button } from "@/components/ui/button";
import {
  eventOriginLabel,
  freshnessLabel,
  formatUpdatedAt,
  providedText,
} from "@/lib/format";
import type {
  AccidentReport,
  ConstructionEvent,
  DataFreshness,
  DisasterAlert,
  EventDataOrigin,
  RoadIntelKind,
  TrafficSegment,
} from "@/types/domain";

export type EventCardModel = {
  kind: Exclude<RoadIntelKind, "cctv">;
  title: string;
  roadName?: string;
  direction?: string;
  description?: string;
  issuedAt?: string;
  updatedAt?: string;
  severity?: string;
  source?: string;
  freshness?: DataFreshness;
  origin?: EventDataOrigin | "ncdr-live" | "tdx-live" | "mock" | "unavailable";
};

export function accidentToCard(item: AccidentReport, origin?: EventDataOrigin): EventCardModel {
  return {
    kind: "accident",
    title: item.title,
    roadName: item.roadName,
    direction: item.direction,
    description: item.description,
    issuedAt: item.issuedAt,
    updatedAt: item.updatedAt,
    severity: item.severity,
    source: item.source,
    freshness: item.freshness,
    origin,
  };
}

export function constructionToCard(
  item: ConstructionEvent,
  origin?: EventDataOrigin,
): EventCardModel {
  return {
    kind: "construction",
    title: item.title,
    roadName: item.roadName,
    direction: item.direction,
    description: item.description,
    issuedAt: item.issuedAt,
    updatedAt: item.updatedAt,
    severity: item.severity,
    source: item.source,
    freshness: item.freshness,
    origin,
  };
}

export function disasterToCard(
  item: DisasterAlert,
  origin?: EventDataOrigin | "ncdr-live" | "mock" | "unavailable",
): EventCardModel {
  return {
    kind: "disaster",
    title: item.title,
    roadName: item.area || item.areaDesc,
    direction: item.category,
    description: item.description,
    issuedAt: item.issuedAt || item.effectiveAt,
    updatedAt: item.updatedAt,
    severity: item.severity,
    source: item.source,
    freshness: origin === "unavailable" ? "unavailable" : origin === "ncdr-live" ? "live" : "stale",
    origin,
  };
}

export function congestionToCard(item: TrafficSegment): EventCardModel {
  return {
    kind: "congestion",
    title: item.name,
    roadName: item.roadName,
    direction: item.direction,
    description: item.congestionLabel,
    updatedAt: item.updatedAt,
    severity: item.level,
    source: item.source === "tdx" ? "TDX 即時路況" : item.source === "mock" ? "示範資料" : "未提供",
    freshness:
      item.dataOrigin === "unavailable"
        ? "unavailable"
        : item.dataOrigin === "tdx-live"
          ? "live"
          : "stale",
    origin: item.dataOrigin,
  };
}

const KIND_LABEL: Record<EventCardModel["kind"], string> = {
  accident: "交通事故",
  construction: "道路施工",
  disaster: "災害警報",
  congestion: "交通壅塞",
};

const KIND_ICON = {
  accident: AccidentTriangleIcon,
  construction: ConstructionBarrierIcon,
  disaster: DisasterWarningIcon,
  congestion: CongestionCarsIcon,
};

export function EventDetailCard({
  event,
  onClose,
  onNavigate,
}: {
  event: EventCardModel;
  onClose: () => void;
  onNavigate?: () => void;
}) {
  const Icon = KIND_ICON[event.kind];
  return (
    <article className="pointer-events-auto w-full max-w-xl rounded-2xl border border-white/12 bg-black/75 p-3 text-white shadow-[0_12px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/8">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] tracking-wide text-zinc-400">{KIND_LABEL[event.kind]}</p>
          <h2 className="truncate text-sm font-semibold">{providedText(event.title)}</h2>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            {freshnessLabel(event.freshness)} · {eventOriginLabel(event.origin)}
          </p>
        </div>
        <button
          type="button"
          aria-label="關閉事件資訊"
          onClick={onClose}
          className="flex size-11 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white touch-manipulation"
        >
          <X className="size-4" />
        </button>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <InfoCell label="道路名稱" value={providedText(event.roadName)} />
        <InfoCell label="方向或路段" value={providedText(event.direction)} />
        <InfoCell label="影響程度" value={providedText(event.severity)} />
        <InfoCell label="資料來源" value={providedText(event.source) === "未提供" ? eventOriginLabel(event.origin) : providedText(event.source)} />
        <InfoCell label="發布時間" value={event.issuedAt ? formatUpdatedAt(event.issuedAt) : "未提供"} />
        <InfoCell label="最後更新" value={event.updatedAt ? formatUpdatedAt(event.updatedAt) : "未提供"} />
      </dl>
      <p className="mt-2 text-xs leading-5 text-zinc-300">
        {providedText(event.description)}
      </p>
      {onNavigate ? (
        <Button
          type="button"
          onClick={onNavigate}
          className="mt-3 h-11 w-full rounded-xl bg-cyan-500 text-black hover:bg-cyan-400 touch-manipulation"
        >
          <Navigation className="size-4" />
          一鍵導航
        </Button>
      ) : null}
    </article>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-white/4 px-2.5 py-2">
      <dt className="text-[10px] tracking-wide text-zinc-500">{label}</dt>
      <dd className="truncate text-zinc-200">{value}</dd>
    </div>
  );
}
