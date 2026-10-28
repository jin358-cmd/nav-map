"use client";

import { Construction, X } from "lucide-react";
import {
  ROADWORK_CLASS_LABEL,
  roadworkField,
  type RoadworkCatalogResponse,
  type RoadworkEvent,
} from "@/lib/roadwork/public";

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
  onSelect,
  onClose,
  onShowSample,
  onClearSample,
  sampleActive,
}: {
  catalog: RoadworkCatalogResponse;
  onSelect: (event: RoadworkEvent) => void;
  onClose: () => void;
  onShowSample: () => void;
  onClearSample: () => void;
  sampleActive: boolean;
}) {
  return (
    <section className="pointer-events-auto w-[min(22rem,calc(100vw-1.5rem))] max-h-[min(28rem,58dvh)] overflow-hidden rounded-2xl border border-sky-200/25 bg-black/78 text-white shadow-2xl backdrop-blur-xl">
      <header className="flex items-start gap-3 border-b border-white/10 px-3 py-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-400/15 text-sky-200">
          <Construction className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] tracking-wide text-sky-200">道路施工</p>
          <h2 className="text-sm font-semibold">公告清單</h2>
          <p className="mt-1 text-[11px] leading-4 text-zinc-400">
            地圖只標已複核座標且在有效期間內的事件。輸入 {catalog.counts.input} 筆，去重後 {catalog.counts.unique}{" "}
            筆，地圖標記 {catalog.counts.mapVisible} 筆。
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
      <div className="max-h-[calc(min(28rem,58dvh)-4.5rem)] space-y-2 overflow-y-auto px-3 py-3">
        {catalog.previewLabel ? (
          <p className="rounded-xl border border-sky-200/20 bg-sky-400/10 px-3 py-2 text-[11px] leading-4 text-sky-100">
            {catalog.previewLabel}
          </p>
        ) : null}
        {catalog.origin === "degraded" && catalog.notices.length === 0 && catalog.mapEvents.length === 0 ? (
          <p className="text-xs leading-5 text-zinc-300">
            施工資料暫時無法載入。地圖維持空白，不顯示施工標記。
          </p>
        ) : null}
        {catalog.origin === "empty" ? (
          <p className="text-xs leading-5 text-zinc-300">目前沒有可顯示的施工事件。</p>
        ) : null}
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
            <span className="text-[10px] text-sky-200">{ROADWORK_CLASS_LABEL[event.display_class]}</span>
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
      </div>
    </section>
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
    <article className="pointer-events-auto w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-sky-200/30 bg-black/80 p-3 text-white shadow-2xl backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-400/15 text-sky-100">
          <Construction className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-sky-200">
            {ROADWORK_CLASS_LABEL[event.display_class]} · {confidence}
          </p>
          <h2 className="mt-0.5 font-semibold">{roadworkField(event.road_name)}</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-300">{roadworkField(event.description)}</p>
          <dl className="mt-2 space-y-1 text-[11px] leading-4 text-zinc-400">
            <div>路段：{roadworkField(event.segment_text)}</div>
            <div>方向：{roadworkField(event.direction)}</div>
            <div>車道：{roadworkField(event.affected_lane)}</div>
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
              className="mt-2 inline-flex rounded-lg border border-sky-200/30 px-2 py-1 text-[11px] text-sky-100"
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
