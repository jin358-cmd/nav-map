"use client";

import { Heart, Navigation, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistance, formatParkingRate, formatUpdatedAgo } from "@/lib/format";
import { formatTaiwanDisplayAddress } from "@/lib/geocoding/format-taiwan-display-address";
import type { MapPlace } from "@/lib/map-place";
import { cn } from "@/lib/utils";

export function PlaceInfoCard({
  place,
  favorite,
  onNavigate,
  onToggleFavorite,
  onClose,
}: {
  place: MapPlace;
  favorite: boolean;
  onNavigate: () => void;
  onToggleFavorite: () => void;
  onClose: () => void;
}) {
  const address = formatTaiwanDisplayAddress(place.address);
  return (
    <article className="pointer-events-auto w-full max-w-xl rounded-2xl border border-cyan-300/20 bg-black/78 p-3 text-white shadow-[0_12px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] tracking-wide text-cyan-200">
            {place.categoryLabel ?? (place.kind === "custom" ? "自訂位置" : "地點")}
          </p>
          <h2 className="truncate text-lg font-bold leading-tight">{place.name}</h2>
        </div>
        <button
          type="button"
          aria-label="關閉地點資訊"
          onClick={onClose}
          className="flex size-11 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white touch-manipulation"
        >
          <X className="size-4" />
        </button>
      </div>
      <dl className="grid gap-1.5 text-[13px] text-zinc-200">
        {address ? (
          <div>
            <dt className="text-[11px] text-zinc-500">地址</dt>
            <dd>{address}</dd>
          </div>
        ) : null}
        {place.distanceMeters != null ? (
          <div>
            <dt className="text-[11px] text-zinc-500">距離</dt>
            <dd>{formatDistance(place.distanceMeters)}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-[11px] text-zinc-500">座標</dt>
          <dd className="tabular-nums">
            {place.location.lat.toFixed(6)}, {place.location.lng.toFixed(6)}
          </dd>
        </div>
        {place.phone ? (
          <div>
            <dt className="text-[11px] text-zinc-500">電話</dt>
            <dd>{place.phone}</dd>
          </div>
        ) : null}
        {place.hours ? (
          <div>
            <dt className="text-[11px] text-zinc-500">營業</dt>
            <dd>{place.hours}</dd>
          </div>
        ) : null}
        {place.openStatus ? (
          <div>
            <dt className="text-[11px] text-zinc-500">營業狀態</dt>
            <dd>{place.openStatus}</dd>
          </div>
        ) : null}
        {place.kind === "parking" ? (
          <>
            <div>
              <dt className="text-[11px] text-zinc-500">剩餘</dt>
              <dd>
                {place.availabilityStatus === "unknown" || place.carAvailable == null
                  ? "即時剩餘車位目前無資料"
                  : `${place.carAvailable} 格`}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-zinc-500">總車位</dt>
              <dd>{place.carTotal != null ? `${place.carTotal} 格` : "未提供"}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-zinc-500">費率</dt>
              <dd>{formatParkingRate(place)}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-zinc-500">最後更新</dt>
              <dd>{formatUpdatedAgo(place.updatedAt)}</dd>
            </div>
          </>
        ) : place.carAvailable != null || place.carTotal != null ? (
          <div>
            <dt className="text-[11px] text-zinc-500">車位</dt>
            <dd>
              {place.carAvailable != null ? `剩餘 ${place.carAvailable}` : "剩餘未提供"}
              {place.carTotal != null ? `／總 ${place.carTotal}` : ""}
            </dd>
          </div>
        ) : null}
        {place.kind !== "parking" && place.fee ? (
          <div>
            <dt className="text-[11px] text-zinc-500">收費</dt>
            <dd>{place.fee}</dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          onClick={onNavigate}
          className="h-12 min-h-12 flex-1 rounded-xl bg-cyan-400 text-base font-semibold text-[#041016] hover:bg-cyan-300"
        >
          <Navigation className="size-4" />
          {place.kind === "parking" ? "導航前往" : "開始導航"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          aria-pressed={favorite}
          aria-label={favorite ? "移出最愛" : "加入最愛"}
          onClick={onToggleFavorite}
          className={cn(
            "size-12 shrink-0 text-rose-200 hover:bg-white/10 hover:text-rose-100",
            favorite && "text-rose-100",
          )}
        >
          <Heart className={cn("size-5", favorite && "fill-rose-500 text-rose-400")} />
        </Button>
      </div>
    </article>
  );
}
