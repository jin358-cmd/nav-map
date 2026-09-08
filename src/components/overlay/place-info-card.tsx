"use client";

import { useState } from "react";
import { Check, Heart, Navigation, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HudCloseButton } from "@/components/overlay/hud-close-button";
import { formatDistance, formatParkingRate, formatUpdatedAgo } from "@/lib/format";
import { formatTaiwanRoadName } from "@/lib/geocoding/format-taiwan-display-address";
import type { MapPlace } from "@/lib/map-place";
import { cn } from "@/lib/utils";

function CustomNameBlock({
  name,
  onRename,
}: {
  name: string;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  const commitRename = () => {
    const next = draft.trim();
    if (next) onRename(next);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="mt-1 flex items-center gap-1">
        <input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitRename();
            if (event.key === "Escape") {
              setDraft(name);
              setEditing(false);
            }
          }}
          aria-label="自訂位置名稱"
          className="h-9 min-w-0 flex-1 rounded-lg border border-cyan-300/30 bg-white/8 px-2 text-base font-semibold text-white outline-none"
        />
        <button
          type="button"
          aria-label="儲存名稱"
          onClick={commitRename}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-cyan-200 hover:bg-white/10 touch-manipulation"
        >
          <Check className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-1">
      <h2 className="truncate text-lg font-bold leading-tight">{name}</h2>
      <button
        type="button"
        aria-label="修改名稱"
        onClick={() => {
          setDraft(name);
          setEditing(true);
        }}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white touch-manipulation"
      >
        <Pencil className="size-3.5" />
      </button>
    </div>
  );
}

export function PlaceInfoCard({
  place,
  favorite,
  onNavigate,
  onToggleFavorite,
  onRename,
  onClose,
}: {
  place: MapPlace;
  favorite: boolean;
  onNavigate: () => void;
  onToggleFavorite: () => void;
  onRename?: (name: string) => void;
  onClose: () => void;
}) {
  const address = formatTaiwanRoadName(place.address);

  return (
    <article className="pointer-events-auto w-full max-w-xl rounded-2xl border border-white/16 bg-black/80 p-3 text-white shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="mb-2 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {place.brand ? (
            <p className="truncate text-[12px] text-cyan-100/80">{place.brand}</p>
          ) : null}
          {onRename ? (
            <CustomNameBlock
              key={place.id}
              name={place.name}
              onRename={onRename}
            />
          ) : (
            <h2 className="truncate text-lg font-bold leading-tight">{place.name}</h2>
          )}
        </div>
        <div className="flex w-11 shrink-0 flex-col items-center gap-1.5">
          <HudCloseButton
            size="lg"
            label="關閉地點資訊"
            onClick={onClose}
          />
          <button
            type="button"
            aria-pressed={favorite}
            aria-label={favorite ? "移出最愛" : "加入最愛"}
            onClick={onToggleFavorite}
            className={cn(
              "hud-window-close hud-window-close--lg touch-manipulation text-rose-200 hover:text-rose-100",
              favorite && "text-rose-100",
            )}
          >
            <Heart className={cn("size-6", favorite && "fill-rose-500 text-rose-400")} />
          </button>
        </div>
      </div>
      <dl className="grid gap-1.5 text-[13px] text-zinc-200">
        {address ? (
          <div>
            <dt className="text-[11px] text-zinc-500">地址</dt>
            <dd>{address}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-[11px] text-zinc-500">電話</dt>
          <dd>
            {place.phone ? (
              <a
                href={`tel:${place.phone.replace(/[^\d+]/g, "")}`}
                className="text-cyan-200 underline-offset-2 hover:underline"
              >
                {place.phone}
              </a>
            ) : (
              "未提供"
            )}
          </dd>
        </div>
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
              <dt className="text-[11px] text-zinc-500">經營</dt>
              <dd>
                {place.publicLot === false ? "民營" : "公有"}
                {place.brand ? ` · ${place.brand}` : ""}
              </dd>
            </div>
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
      <div className="mt-3">
        <Button
          type="button"
          onClick={onNavigate}
          className="h-12 min-h-12 w-full rounded-xl bg-cyan-400 text-base font-semibold text-[#041016] hover:bg-cyan-300"
        >
          <Navigation className="size-4" />
          {place.kind === "parking" ? "導航前往" : "開始導航"}
        </Button>
      </div>
    </article>
  );
}
