"use client";

import type { ReactNode } from "react";
import { Briefcase, Home, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SavedPlace } from "@/types/domain";

export function SavedPlaceBar({
  home,
  work,
  onGo,
  onEdit,
}: {
  home: SavedPlace | null;
  work: SavedPlace | null;
  onGo: (place: SavedPlace) => void;
  onEdit: (type: "home" | "work") => void;
}) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      <Shortcut
        label={home?.displayName || "回家"}
        set={Boolean(home)}
        icon={<Home className="size-3.5" />}
        onGo={() => (home ? onGo(home) : onEdit("home"))}
        onEdit={() => onEdit("home")}
      />
      <Shortcut
        label={work?.displayName || "公司"}
        set={Boolean(work)}
        icon={<Briefcase className="size-3.5" />}
        onGo={() => (work ? onGo(work) : onEdit("work"))}
        onEdit={() => onEdit("work")}
      />
    </div>
  );
}

function Shortcut({
  label,
  set,
  icon,
  onGo,
  onEdit,
}: {
  label: string;
  set: boolean;
  icon: ReactNode;
  onGo: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="inline-flex items-center overflow-hidden rounded-full border border-white/12 bg-black/55">
      <Button
        type="button"
        variant="ghost"
        onClick={onGo}
        className="h-8 gap-1 rounded-none px-2.5 text-xs text-zinc-100 hover:bg-white/10"
      >
        {icon}
        <span className="max-w-24 truncate">{label}</span>
        {set ? null : <span className="text-[10px] text-zinc-400">未設定</span>}
      </Button>
      <Button
        type="button"
        variant="ghost"
        aria-label={`編輯${label}`}
        onClick={onEdit}
        className="h-8 w-8 rounded-none px-0 text-zinc-400 hover:bg-white/10 hover:text-white"
      >
        <Pencil className="size-3.5" />
      </Button>
    </div>
  );
}
