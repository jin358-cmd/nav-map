"use client";

import { useState } from "react";
import { Camera, Radio, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cctvStatusLabel } from "@/lib/format";
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
  const online = camera.status === "online";

  return (
    <section className="pointer-events-auto w-full max-w-xl rounded-3xl border border-violet-300/25 bg-black/60 p-4 text-white shadow-[0_12px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-300">
          <Camera className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-semibold">{camera.name}</h2>
            <Badge
              className={cn(
                "border-0",
                online && "bg-emerald-500/20 text-emerald-300",
                camera.status === "offline" && "bg-zinc-500/20 text-zinc-300",
                camera.status === "maintenance" && "bg-amber-500/20 text-amber-200",
              )}
            >
              {cctvStatusLabel(camera.status)}
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-zinc-300">{camera.intersection}</p>
          <p className="text-xs text-zinc-500">
            {camera.district} · {camera.snapshotLabel}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="關閉"
          onClick={onClose}
          className="text-zinc-300 hover:bg-white/10 hover:text-white"
        >
          <X />
        </Button>
      </div>

      {showFeed ? (
        <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
          <div className="flex items-center justify-between px-3 py-1.5 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5 text-violet-300">
              <Radio className="size-3 animate-pulse" />
              即時影像（模擬）
            </span>
            <span>TDX 尚未串接</span>
          </div>
          <div className="relative aspect-video bg-[radial-gradient(circle_at_30%_40%,#2a1848,transparent_45%),linear-gradient(180deg,#0b0d11,black)]">
            <div className="cctv-scan absolute inset-0" />
            <div className="absolute inset-x-4 bottom-4 flex items-end justify-between text-[11px] text-cyan-100/80">
              <span>{camera.intersection}</span>
              <span>CAM {camera.id.replace("cctv-", "").toUpperCase()}</span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex gap-2">
        <Button
          onClick={() => setShowFeed(true)}
          disabled={!online}
          className="flex-1 rounded-xl bg-violet-500 text-white hover:bg-violet-400 disabled:bg-zinc-700"
        >
          查看即時影像
        </Button>
        <Button
          variant="outline"
          onClick={onClose}
          className="rounded-xl border-white/15 bg-transparent text-zinc-200 hover:bg-white/10"
        >
          返回情報
        </Button>
      </div>
    </section>
  );
}
