"use client";

import { useState, type ReactNode } from "react";
import { Construction, X } from "lucide-react";
import {
  ROADWORK_CLASS_LABEL,
  roadworkField,
  type RoadworkCatalogResponse,
  type RoadworkEvent,
} from "@/lib/roadwork/public";
import { formatDistance } from "@/lib/format";
import type { EventDataOrigin, RoadIntelItem } from "@/types/domain";

function formatWhen(value: string | null) {
  if (!value) return "尚未確認";
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) return `${Number(dateOnly[1])}/${Number(dateOnly[2])}/${Number(dateOnly[3])}`;
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return "尚未確認";
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(time);
}

export function RoadworkPanel({
  catalog,
  events,
  eventOrigin,
  layerOn,
  onToggleLayer,
  onSelectEvent,
  onSelectNotice,
  onClose,
  onShowSample,
  onClearSample,
  sampleActive,
}: {
  catalog: RoadworkCatalogResponse;
  events: RoadIntelItem[];
  eventOrigin: EventDataOrigin;
  layerOn: boolean;
  onToggleLayer: () => void;
  onSelectEvent: (item: RoadIntelItem) => void;
  onSelectNotice: (event: RoadworkEvent) => void;
  onClose: () => void;
  onShowSample: () => void;
  onClearSample: () => void;
  sampleActive: boolean;
}) {
  const noticeCount = catalog.counts.notices;
  const [tab, setTab] = useState<"events" | "notices">("events");
  return (
    <section
      id="navpilot-roadwork-panel"
      className="pointer-events-auto w-[min(22rem,calc(100vw-1.5rem))] max-h-[min(24rem,46dvh)] overflow-hidden rounded-2xl border border-amber-200/30 bg-black/82 text-white shadow-2xl backdrop-blur-xl"
    >
      <header className="flex items-start gap-3 border-b border-white/10 px-3 py-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-200">
          <Construction className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] tracking-wide text-amber-200">施工資訊</p>
          <h2 className="text-sm font-semibold">施工事件 {events.length}｜公告 {noticeCount}</h2>
          <p className="mt-1 text-[11px] leading-4 text-zinc-400">
            兩種數量分開計算。沒有可靠座標的公告不落點，也不自動改道。
          </p>
        </div>
        <button
          type="button"
          aria-label="關閉道路施工"
          onClick={onClose}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10"
        >
          <X className="size-4" />
        </button>
      </header>
      <div className="flex gap-1 px-3 pt-2">
        <TabButton pressed={tab === "events"} onClick={() => setTab("events")}>
          施工事件 ({events.length})
        </TabButton>
        <TabButton pressed={tab === "notices"} onClick={() => setTab("notices")}>
          官方公告 ({noticeCount})
        </TabButton>
      </div>
      <div className="max-h-[calc(min(24rem,46dvh)-7.2rem)] space-y-2 overflow-y-auto px-3 py-3">
        {tab === "events" ? (
          <EventsTab
            events={events}
            origin={eventOrigin}
            layerOn={layerOn}
            onToggleLayer={onToggleLayer}
            onSelect={onSelectEvent}
          />
        ) : (
          <NoticesTab
            catalog={catalog}
            sampleActive={sampleActive}
            onSelect={onSelectNotice}
            onShowSample={onShowSample}
            onClearSample={onClearSample}
          />
        )}
      </div>
    </section>
  );
}

function TabButton({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={
        pressed
          ? "rounded-lg bg-amber-400/20 px-2 py-1 text-[11px] text-amber-100"
          : "rounded-lg px-2 py-1 text-[11px] text-zinc-400 hover:bg-white/10"
      }
    >
      {children}
    </button>
  );
}

function EventsTab({
  events,
  origin,
  layerOn,
  onToggleLayer,
  onSelect,
}: {
  events: RoadIntelItem[];
  origin: EventDataOrigin;
  layerOn: boolean;
  onToggleLayer: () => void;
  onSelect: (item: RoadIntelItem) => void;
}) {
  return (
    <>
      <p className="text-[11px] leading-4 text-zinc-400">
        {origin === "unavailable"
          ? "施工事件暫時無法取得。"
          : "來源或時效未確認時，不能稱為即時。"}
      </p>
      <button
        type="button"
        aria-pressed={layerOn}
        onClick={onToggleLayer}
        className="w-full rounded-xl border border-amber-200/30 px-3 py-2 text-left text-[11px] text-amber-100 hover:bg-white/10"
      >
        {layerOn ? "隱藏既有施工圖層" : "顯示既有施工圖層"}
      </button>
      {events.length === 0 ? (
        <p className="text-xs leading-5 text-zinc-300">目前畫面內沒有施工事件。</p>
      ) : (
        events.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            className="block w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left hover:bg-white/10"
          >
            <span className="block text-sm font-medium">{item.title}</span>
            <span className="mt-1 block text-[11px] leading-4 text-zinc-400">{item.detail}</span>
            <span className="mt-1 block text-[11px] text-zinc-500">{formatDistance(item.distanceMeters)}</span>
          </button>
        ))
      )}
    </>
  );
}

function NoticesTab({
  catalog,
  sampleActive,
  onSelect,
  onShowSample,
  onClearSample,
}: {
  catalog: RoadworkCatalogResponse;
  sampleActive: boolean;
  onSelect: (event: RoadworkEvent) => void;
  onShowSample: () => void;
  onClearSample: () => void;
}) {
  return (
    <>
      {catalog.previewLabel ? (
        <p className="rounded-xl border border-amber-200/20 bg-amber-400/10 px-3 py-2 text-[11px] leading-4 text-amber-100">
          {catalog.previewLabel}
        </p>
      ) : null}
      <p className="text-[11px] leading-4 text-zinc-400">
        輸入 {catalog.counts.input} 筆，去重後 {catalog.counts.unique} 筆，地圖標記 {catalog.counts.mapVisible} 筆。
      </p>
      {catalog.notices.length === 0 && catalog.mapEvents.length === 0 ? (
        <p className="text-xs leading-5 text-zinc-400">公告清單是空的。</p>
      ) : null}
      {[...catalog.mapEvents, ...catalog.notices].map((event) => (
        <button
          key={event.id}
          type="button"
          onClick={() => onSelect(event)}
          className="block w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left hover:bg-white/10"
        >
          <span className="text-[10px] text-amber-200">{ROADWORK_CLASS_LABEL[event.display_class]}</span>
          <span className="mt-0.5 block text-sm font-medium">{roadworkField(event.road_name)}</span>
          <span className="mt-1 block text-[11px] leading-4 text-zinc-300">{roadworkField(event.segment_text)}</span>
          <span className="mt-1 block text-[11px] leading-4 text-zinc-400">
            {formatWhen(event.scheduled_start)} – {formatWhen(event.scheduled_end)}
          </span>
        </button>
      ))}
      {process.env.NODE_ENV !== "production" ? (
        <button
          type="button"
          onClick={sampleActive ? onClearSample : onShowSample}
          className="w-full rounded-xl border border-white/15 px-3 py-2 text-left text-[11px] text-zinc-300 hover:bg-white/10"
        >
          {sampleActive ? "回到官方公告樣本" : "檢視結構測試公告（非官方，含一筆重複來源）"}
        </button>
      ) : null}
    </>
  );
}

export function RoadworkDetailCard({
  event,
  onClose,
}: {
  event: RoadworkEvent;
  onClose: () => void;
}) {
  const confidence =
    event.geometry_confidence === "verified"
      ? "已複核座標"
      : event.geometry_confidence === "reported"
        ? "來源附有座標，尚未複核"
        : "無可靠座標";

  return (
    <article className="pointer-events-auto w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-amber-200/30 bg-black/80 p-3 text-white shadow-2xl backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-100">
          <Construction className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-amber-200">
            {ROADWORK_CLASS_LABEL[event.display_class]} · {confidence}
          </p>
          <h2 className="mt-0.5 font-semibold">{roadworkField(event.road_name)}</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-300">{roadworkField(event.description)}</p>
          <dl className="mt-2 space-y-1 text-[11px] leading-4 text-zinc-400">
            <div>路段：{roadworkField(event.segment_text)}</div>
            <div>方向：{roadworkField(event.direction)}</div>
            <div>車道：{roadworkField(event.affected_lane)}</div>
            <div>公告日期：{formatWhen(event.published_at)}</div>
            <div>
              時間：{formatWhen(event.scheduled_start)} – {formatWhen(event.scheduled_end)}
            </div>
            <div>最新確認：{formatWhen(event.last_verified_at)}</div>
          </dl>
          {event.source_url ? (
            <a
              href={event.source_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex rounded-lg border border-amber-200/30 px-2 py-1 text-[11px] text-amber-100"
            >
              查看來源
            </a>
          ) : (
            <p className="mt-2 text-[11px] text-zinc-500">來源連結：尚未確認</p>
          )}
          <p className="mt-2 text-[11px] text-zinc-500">
            {event.display_class === "closure_verified"
              ? "來源已提供封路條件。導航不會因此自動改道。"
              : "這則資料不代表道路現在封閉。"}
          </p>
        </div>
        <button
          type="button"
          aria-label="關閉施工資訊"
          onClick={onClose}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10"
        >
          <X className="size-4" />
        </button>
      </div>
    </article>
  );
}
