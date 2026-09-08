"use client";

import { useState } from "react";
import { Check, Heart, MapPin, Pencil, Trash2, X } from "lucide-react";
import { formatTaiwanDisplayAddress } from "@/lib/geocoding/format-taiwan-display-address";
import type { GeocodeHit } from "@/types/domain";

export function FavoritesPanel({
  favorites,
  canFavorite,
  isCurrentFavorite,
  onAddCurrent,
  onSelect,
  onRemove,
  onRename,
  onClose,
}: {
  favorites: GeocodeHit[];
  canFavorite: boolean;
  isCurrentFavorite: boolean;
  onAddCurrent?: () => void;
  onSelect?: (hit: GeocodeHit) => void;
  onRemove?: (hit: GeocodeHit) => void;
  onRename?: (hit: GeocodeHit, name: string) => void;
  onClose?: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const commitRename = (hit: GeocodeHit) => {
    const next = draft.trim();
    if (next) onRename?.(hit, next);
    setEditingId(null);
    setDraft("");
  };

  return (
    <div className="w-full rounded-2xl border border-rose-300/25 bg-black/82 px-2.5 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[11px] tracking-wide text-rose-200/90">最愛書籤</p>
        <button
          type="button"
          aria-label="收合最愛"
          onClick={onClose}
          className="flex size-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white touch-manipulation"
        >
          <X className="size-3.5" />
        </button>
      </div>
      {canFavorite && !isCurrentFavorite ? (
        <button
          type="button"
          onClick={onAddCurrent}
          className="mb-1.5 flex w-full items-center gap-2 rounded-xl border border-rose-300/25 bg-rose-500/15 px-2 py-1.5 text-left text-sm text-rose-100 hover:bg-rose-500/25 touch-manipulation"
        >
          <Heart className="size-4 fill-rose-500" />
          加入目前位置
        </button>
      ) : null}
      {favorites.length === 0 ? (
        <p className="px-1 py-2 text-sm text-zinc-300">
          還沒有書籤。搜尋店家或長按地圖後，再點紅心即可加入最愛。
        </p>
      ) : (
        <ul className="max-h-[22.75rem] overflow-y-auto">
          {favorites.map((hit) => {
            const editing = editingId === hit.id;
            return (
              <li key={hit.id} className="flex min-h-8 items-start gap-0.5">
                {editing ? (
                  <div className="flex min-w-0 flex-1 items-center gap-1 px-1 py-1">
                    <input
                      autoFocus
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") commitRename(hit);
                        if (event.key === "Escape") {
                          setEditingId(null);
                          setDraft("");
                        }
                      }}
                      aria-label="書籤名稱"
                      className="h-8 min-w-0 flex-1 rounded-lg border border-rose-300/30 bg-white/8 px-2 text-lg text-white outline-none"
                    />
                    <button
                      type="button"
                      aria-label="儲存名稱"
                      onClick={() => commitRename(hit)}
                      className="flex size-7 shrink-0 items-center justify-center rounded-lg text-rose-200 hover:bg-white/10 touch-manipulation"
                    >
                      <Check className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="取消編輯"
                      onClick={() => {
                        setEditingId(null);
                        setDraft("");
                      }}
                      className="flex size-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white touch-manipulation"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onSelect?.(hit)}
                      className="flex min-w-0 flex-1 items-start gap-2 px-1 py-1.5 text-left hover:bg-white/8 touch-manipulation"
                    >
                      <MapPin className="mt-0.5 size-3.5 shrink-0 text-rose-300" />
                      <span className="min-w-0">
                        <span className="block truncate text-lg font-semibold leading-tight">
                          {formatTaiwanDisplayAddress(hit.name)}
                        </span>
                        <span className="block truncate text-[11px] text-zinc-500">
                          {formatTaiwanDisplayAddress(hit.address)}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`編輯${hit.name}名稱`}
                      onClick={() => {
                        setEditingId(hit.id);
                        setDraft(hit.name);
                      }}
                      className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white touch-manipulation"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`移除${hit.name}`}
                      onClick={() => onRemove?.(hit)}
                      className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/10 hover:text-white touch-manipulation"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
