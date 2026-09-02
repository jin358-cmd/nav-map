"use client";

import { useState } from "react";
import { Camera, Radio, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isCameraUrlUsable } from "@/lib/cctv-normalize";
import {
  cctvOriginLabel,
  cctvStatusLabel,
  formatDistanceKm,
  formatUpdatedAt,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CctvCamera } from "@/types/domain";

export function CctvDetailCard({
  camera,
  onClose,
}: {
  camera: CctvCamera;
  onClose: () => void;
}) {
  const [showFeed, setShowFeed] = useState(false);
  const [feedFailed, setFeedFailed] = useState(false);
  const urlUsable = isCameraUrlUsable(camera.url);
  const canOpenFeed = urlUsable && camera.status !== "unsupported";

  return (
    <section className="pointer-events-auto w-full max-w-xl rounded-2xl border border-violet-300/25 bg-black/60 p-3 text-white shadow-[0_12px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:rounded-3xl sm:p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-300 sm:size-11">
          <Camera className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-sm font-semibold sm:text-base">
              {camera.name}
            </h2>
            <Badge
              className={cn(
                "border-0",
                camera.status === "online" && "bg-emerald-500/20 text-emerald-300",
                camera.status === "offline" && "bg-zinc-500/20 text-zinc-300",
                camera.status === "unsupported" && "bg-amber-500/20 text-amber-200",
                camera.status === "unknown" && "bg-violet-500/20 text-violet-200",
              )}
            >
              {cctvStatusLabel(camera.status)}
            </Badge>
            <Badge className="border-0 bg-white/8 text-zinc-300">
              {cctvOriginLabel(camera.dataOrigin)}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-sm text-zinc-300">
            {camera.intersection}
          </p>
          <p className="truncate text-xs text-zinc-500">
            {camera.sourceType === "freeway" ? "國道 CCTV" : "市區 CCTV"}
            {camera.directionLabel ? ` · ${camera.directionLabel}` : ""}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="關閉"
          onClick={onClose}
          className="size-11 text-zinc-300 hover:bg-white/10 hover:text-white touch-manipulation"
        >
          <X />
        </Button>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <InfoCell label="道路 / 路口" value={camera.intersection} />
        <InfoCell label="方向" value={camera.directionLabel || "未標示"} />
        <InfoCell label="距離目前位置" value={formatDistanceKm(camera.distanceKm)} />
        <InfoCell label="資料來源" value={cctvOriginLabel(camera.dataOrigin)} />
      </dl>
      <p className="mt-2 text-[11px] text-zinc-500">
        更新狀態：{cctvStatusLabel(camera.status)} · {formatUpdatedAt(camera.updatedAt)}
      </p>

      {showFeed ? (
        <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
          <div className="flex items-center justify-between px-3 py-1.5 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5 text-violet-300">
              <Radio className="size-3 animate-pulse" />
              即時影像
            </span>
            <span>{cctvOriginLabel(camera.dataOrigin)}</span>
          </div>
          {urlUsable && !feedFailed ? (
            // Snapshot JPEG / MJPEG. CORS or dead URLs fall back without breaking the HUD.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={camera.url}
              alt={camera.name}
              className="aspect-video max-h-40 w-full object-cover sm:max-h-56"
              onError={() => setFeedFailed(true)}
            />
          ) : (
            <div className="relative aspect-video max-h-40 bg-[radial-gradient(circle_at_30%_40%,#2a1848,transparent_45%),linear-gradient(180deg,#0b0d11,black)] sm:max-h-56">
              <div className="cctv-scan absolute inset-0" />
              <p className="absolute inset-x-4 bottom-3 text-[11px] text-zinc-400">
                {feedFailed
                  ? "影像無法載入（網址失效或跨域限制），地圖不受影響。"
                  : "此鏡頭沒有可用影像網址。"}
              </p>
            </div>
          )}
        </div>
      ) : null}

      <div className="mt-3 flex gap-2">
        <Button
          onClick={() => setShowFeed(true)}
          disabled={!canOpenFeed}
          className="h-11 flex-1 rounded-xl bg-violet-500 text-white hover:bg-violet-400 disabled:bg-zinc-700 touch-manipulation"
        >
          查看即時影像
        </Button>
        <Button
          variant="outline"
          onClick={onClose}
          className="h-11 rounded-xl border-white/15 bg-transparent text-zinc-200 hover:bg-white/10 touch-manipulation"
        >
          返回情報
        </Button>
      </div>
    </section>
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
