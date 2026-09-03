"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppInstall } from "@/hooks/use-app-install";
import { APP_BOOKMARK_NAME, APP_TAGLINE } from "@/lib/app-brand";

export default function InstallPage() {
  const { canInstall, installed, iosHint, install } = useAppInstall();
  const [copied, setCopied] = useState(false);
  const installUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/install`;
  }, []);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#0b0d11] px-4 py-10 text-zinc-100">
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-black/55 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/navpilot.png"
          alt={APP_BOOKMARK_NAME}
          width={128}
          height={128}
          className="mx-auto size-28 rounded-[28px] border border-white/15 shadow-[0_10px_30px_rgba(0,0,0,0.45)]"
        />
        <h1 className="mt-5 text-center text-2xl font-bold tracking-tight">
          {APP_BOOKMARK_NAME}
        </h1>
        <p className="mt-1 text-center text-sm text-zinc-400">{APP_TAGLINE}</p>

        {installed ? (
          <p className="mt-5 rounded-2xl bg-cyan-400/10 px-3 py-2 text-center text-sm text-cyan-100">
            已安裝。桌面圖示與書籤名稱為「{APP_BOOKMARK_NAME}」。
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-2.5">
          {canInstall ? (
            <Button
              type="button"
              onClick={() => void install()}
              className="h-12 rounded-2xl bg-cyan-400 text-base font-semibold text-[#041016] hover:bg-cyan-300"
            >
              <Download className="size-4" />
              安裝到桌面
            </Button>
          ) : null}

          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              const url = window.location.origin;
              if (navigator.share) {
                try {
                  await navigator.share({
                    title: APP_BOOKMARK_NAME,
                    text: APP_TAGLINE,
                    url,
                  });
                  return;
                } catch {
                  /* 改複製連結 */
                }
              }
              await navigator.clipboard.writeText(url);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            }}
            className="h-11 rounded-2xl border-white/15 bg-white/6"
          >
            {copied ? <Check className="size-4" /> : <Share className="size-4" />}
            {copied ? "已複製安裝連結" : "複製／分享安裝連結"}
          </Button>

          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-2xl text-sm text-cyan-200 hover:text-white"
          >
            開啟地圖
          </Link>
        </div>

        <ol className="mt-6 space-y-2 text-[13px] leading-relaxed text-zinc-400">
          <li>1. 用手機或電腦瀏覽器開啟此頁或首頁連結。</li>
          <li>
            2. Chrome／Edge：點「安裝到桌面」。安裝後桌面圖示即為此圖，名稱為
            「{APP_BOOKMARK_NAME}」。
          </li>
          {iosHint ? (
            <li>
              3. iPhone／iPad：點底部分享
              <span className="mx-1 inline-block align-middle text-zinc-200">□↑</span>
              再選「加入主畫面」。
            </li>
          ) : (
            <li>3. Safari：分享選單 →「加入主畫面」或加入書籤。</li>
          )}
        </ol>
        {installUrl ? (
          <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
            <Copy className="size-3" />
            {installUrl}
          </p>
        ) : null}
      </div>
    </main>
  );
}
