"use client";

import { useMemo, useState } from "react";
import { Home, Briefcase, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatTaiwanDisplayAddress } from "@/lib/geocoding/format-taiwan-display-address";
import { searchAddresses } from "@/services/routing";
import type { LngLat, SavedPlace, SavedPlaceType } from "@/types/domain";

export function PlaceEditor({
  type,
  existing,
  currentLocation,
  pickLocation,
  pickAddress,
  onStartPick,
  onConfirmPick,
  onReselect,
  onCancelPick,
  onSave,
  onRename,
  onDelete,
  onClose,
}: {
  type: SavedPlaceType;
  existing: SavedPlace | null;
  currentLocation: LngLat;
  pickLocation: LngLat | null;
  pickAddress: string | null;
  onStartPick: () => void;
  onConfirmPick: () => void;
  onReselect: () => void;
  onCancelPick: () => void;
  onSave: (input: {
    displayName: string;
    originalAddress?: string;
    latitude: number;
    longitude: number;
  }) => void;
  onRename: (displayName: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const title = type === "home" ? "住家" : type === "work" ? "公司" : "自訂位置";
  const Icon = type === "home" ? Home : type === "work" ? Briefcase : MapPin;
  const [query, setQuery] = useState("");
  const [name, setName] = useState(existing?.displayName ?? title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hits, setHits] = useState<Array<{
    name: string;
    address: string;
    location: LngLat;
  }>>([]);

  const pickLabel = useMemo(() => {
    if (!pickLocation) return null;
    return `${pickLocation.lat.toFixed(6)}, ${pickLocation.lng.toFixed(6)}`;
  }, [pickLocation]);

  async function runSearch() {
    const needle = query.trim();
    if (needle.length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const results = await searchAddresses(needle, currentLocation, undefined, "search");
      setHits(
        results.slice(0, 6).map((hit) => ({
          name: hit.name,
          address: hit.address,
          location: hit.location,
        })),
      );
      if (results.length === 0) setError("找不到符合的地址");
    } catch {
      setError("地址搜尋失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/12 bg-black/82 p-3 text-zinc-100 shadow-[0_16px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="size-4 text-cyan-200" />
        <p className="text-sm font-semibold">{existing ? `編輯${title}` : `設定${title}`}</p>
      </div>

      {pickLocation ? (
        <div className="space-y-2 text-sm">
          <p>緯度 {pickLocation.lat.toFixed(6)}</p>
          <p>經度 {pickLocation.lng.toFixed(6)}</p>
          <p className="truncate text-zinc-400">
            {pickAddress
              ? formatTaiwanDisplayAddress(pickAddress)
              : "地址未提供，將保留座標"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="h-10" onClick={onConfirmPick}>
              確認此位置
            </Button>
            <Button type="button" variant="outline" className="h-10" onClick={onReselect}>
              重新選擇
            </Button>
            <Button type="button" variant="ghost" className="h-10" onClick={onCancelPick}>
              取消
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="顯示名稱"
            className="h-10 bg-black/40"
          />
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void runSearch();
              }}
              placeholder="搜尋地址"
              className="h-10 bg-black/40"
            />
            <Button type="button" className="h-10" disabled={busy} onClick={() => void runSearch()}>
              搜尋
            </Button>
          </div>
          {error ? <p className="text-xs text-amber-200">{error}</p> : null}
          <ul className="max-h-32 space-y-1 overflow-y-auto text-sm">
            {hits.map((hit) => (
              <li key={`${hit.location.lng}-${hit.location.lat}`}>
                <button
                  type="button"
                  className="w-full rounded-xl px-2 py-1.5 text-left hover:bg-white/8"
                  onClick={() =>
                    onSave({
                      displayName: name.trim() || hit.name,
                      originalAddress: formatTaiwanDisplayAddress(hit.address),
                      latitude: hit.location.lat,
                      longitude: hit.location.lng,
                    })
                  }
                >
                  <span className="block truncate">
                    {formatTaiwanDisplayAddress(hit.name)}
                  </span>
                  <span className="block truncate text-[11px] text-zinc-500">
                    {formatTaiwanDisplayAddress(hit.address)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10"
              onClick={() =>
                onSave({
                  displayName: name.trim() || title,
                  originalAddress: "目前定位",
                  latitude: currentLocation.lat,
                  longitude: currentLocation.lng,
                })
              }
            >
              使用目前定位
            </Button>
            <Button type="button" variant="outline" className="h-10" onClick={onStartPick}>
              地圖選點
            </Button>
            {existing ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10"
                  onClick={() => onRename(name)}
                >
                  只改名稱
                </Button>
                <Button type="button" variant="ghost" className="h-10 text-rose-200" onClick={onDelete}>
                  刪除
                </Button>
              </>
            ) : null}
            <Button type="button" variant="ghost" className="h-10" onClick={onClose}>
              關閉
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
