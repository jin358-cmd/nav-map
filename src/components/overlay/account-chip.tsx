"use client";

import { Cloud, LogOut } from "lucide-react";
import type { GoogleAccount } from "@/lib/google-identity";
import { cn } from "@/lib/utils";

export function AccountChip({
  account,
  busy,
  hint,
  configured,
  unavailable,
  onSignIn,
  onSignOut,
}: {
  account: GoogleAccount | null;
  busy?: boolean;
  hint?: string | null;
  configured: boolean;
  unavailable?: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  if (account) {
    return (
      <div className="relative flex min-w-0 max-w-[11.5rem] items-center gap-1.5">
        <button
          type="button"
          title={`${account.name} · 書籤已同步到 Google 帳號`}
          onClick={onSignOut}
          className="flex min-w-0 items-center gap-1.5 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-1.5 py-1 text-left touch-manipulation"
        >
          {account.picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={account.picture}
              alt=""
              width={22}
              height={22}
              className="size-[22px] shrink-0 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-cyan-400/20 text-[10px] text-cyan-100">
              {account.name.slice(0, 1)}
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-[11px] font-medium leading-tight text-white">
              {account.name}
            </span>
            <span className="flex items-center gap-0.5 text-[9px] leading-tight text-cyan-200/80">
              <Cloud className="size-2.5" />
              Google 書籤
            </span>
          </span>
          <LogOut className="size-3 shrink-0 text-zinc-400" />
        </button>
        {hint ? (
          <p className="absolute bottom-full left-1/2 mb-1 w-40 -translate-x-1/2 rounded-lg bg-black/80 px-2 py-1 text-center text-[10px] text-zinc-300">
            {hint}
          </p>
        ) : null}
      </div>
    );
  }

  const blocked = !configured || unavailable;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={blocked ? "Google 登入尚未完成設定" : "使用 Google 帳號登入並把書籤存進你的帳號"}
        aria-disabled={blocked || busy}
        disabled={Boolean(busy && configured)}
        onClick={onSignIn}
        className={cn(
          "flex size-9 items-center justify-center rounded-full border text-[11px] touch-manipulation min-[431px]:size-auto min-[431px]:max-w-[9.5rem] min-[431px]:gap-1.5 min-[431px]:px-2.5 min-[431px]:py-1.5",
          blocked
            ? "cursor-not-allowed border-white/8 bg-white/4 text-zinc-500"
            : "border-white/15 bg-white/8 text-white hover:bg-white/12",
        )}
      >
        <GoogleMark />
        <span className="hidden truncate font-medium min-[431px]:inline">
          {busy && configured ? "登入中…" : blocked ? "無法使用" : "Google 登入"}
        </span>
      </button>
      {hint ? (
        <p className="absolute bottom-full left-1/2 z-20 mb-1 w-44 -translate-x-1/2 rounded-lg bg-black/80 px-2 py-1 text-center text-[10px] text-amber-100">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="size-3.5" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.6 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.66-3.88 2.66-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.17.29-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z"
      />
    </svg>
  );
}
