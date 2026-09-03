"use client";

import { useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  Loader2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  YOUTUBE_MUSIC_URL,
  YOUTUBE_PLAYLISTS,
  type YoutubePlaylist,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { statusMessage, type YoutubeLibraryStatus } from "@/lib/youtube-library";
import {
  loadYouTubeIframeApi,
  YT_PAUSED,
  YT_PLAYING,
  type YouTubePlayer,
} from "@/lib/youtube-iframe";

function readTrackMeta(player: YouTubePlayer) {
  try {
    const data = player.getVideoData();
    return {
      title: data.title?.trim() || "YouTube Music",
      artist: data.author?.trim() || "駕駛聆聽",
    };
  } catch {
    return null;
  }
}

function loadMix(player: YouTubePlayer, playlist: YoutubePlaylist) {
  try {
    if (playlist.youtubeListId) {
      player.loadPlaylist({
        list: playlist.youtubeListId,
        listType: "playlist",
        index: 0,
      });
    } else if (playlist.videoIds && playlist.videoIds.length > 0) {
      player.loadPlaylist([...playlist.videoIds]);
    } else {
      return;
    }
    player.playVideo();
  } catch {
    /* 瀏覽器可能擋住自動播放 */
  }
}

export function YouTubeMusicPlayer({
  compact = false,
  hidden = false,
  playlists = YOUTUBE_PLAYLISTS,
  libraryStatus = "idle",
  libraryMessage = "",
  signedIn = false,
  onClose,
  onExpand,
  onPlaying,
  onPaused,
  onConnectLibrary,
}: {
  compact?: boolean;
  hidden?: boolean;
  playlists?: readonly YoutubePlaylist[];
  libraryStatus?: YoutubeLibraryStatus;
  libraryMessage?: string;
  signedIn?: boolean;
  onClose: () => void;
  onExpand?: () => void;
  onPlaying?: () => void;
  onPaused?: () => void;
  onConnectLibrary?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const onPlayingRef = useRef(onPlaying);

  useEffect(() => {
    onPlayingRef.current = onPlaying;
  }, [onPlaying]);
  const [playing, setPlaying] = useState(false);
  const [title, setTitle] = useState("YouTube Music");
  const [artist, setArtist] = useState("駕駛聆聽");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const catalog = playlists.length > 0 ? playlists : YOUTUBE_PLAYLISTS;
  const [playlistId, setPlaylistId] = useState(catalog[0].id);
  const playlist =
    catalog.find((item) => item.id === playlistId) ?? catalog[0];
  const onPausedRef = useRef(onPaused);

  useEffect(() => {
    onPausedRef.current = onPaused;
  }, [onPaused]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    const initial = YOUTUBE_PLAYLISTS[0];

    void loadYouTubeIframeApi()
      .then((Player) => {
        if (cancelled || !hostRef.current) return;
        const mix = [...(initial.videoIds ?? [])];
        if (!mix[0]) return;
        const player = new Player(hostRef.current, {
          width: "100%",
          height: "100%",
          videoId: mix[0],
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            playlist: mix.slice(1).join(","),
            origin: window.location.origin,
            enablejsapi: 1,
          },
          events: {
            onReady: (event) => {
              if (cancelled) return;
              setReady(true);
              setError(null);
              try {
                event.target.playVideo();
              } catch {
                /* 瀏覽器可能擋住自動播放，使用者再按播放即可 */
              }
              const meta = readTrackMeta(event.target);
              if (meta) {
                setTitle(meta.title);
                setArtist(meta.artist);
              }
            },
            onStateChange: (event) => {
              if (cancelled) return;
              const nowPlaying = event.data === YT_PLAYING;
              setPlaying(nowPlaying);
              if (nowPlaying) onPlayingRef.current?.();
              if (event.data === YT_PAUSED) onPausedRef.current?.();
              if (event.data === YT_PLAYING || event.data === YT_PAUSED) {
                const meta = readTrackMeta(event.target);
                if (meta) {
                  setTitle(meta.title);
                  setArtist(meta.artist);
                }
              }
            },
            onError: () => {
              if (cancelled) return;
              setError("無法在小窗播放，請改開 YouTube Music。");
              setReady(true);
            },
          },
        });
        playerRef.current = player;
      })
      .catch(() => {
        if (!cancelled) {
          setError("無法載入播放器，請改開 YouTube Music。");
          setReady(true);
        }
      });

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy();
      } catch {
        /* YouTube 在快速卸載時可能已銷毀 */
      }
      playerRef.current = null;
    };
  }, []);

  function togglePlay() {
    const player = playerRef.current;
    if (!player) return;
    try {
      const state = player.getPlayerState();
      if (state === YT_PLAYING) player.pauseVideo();
      else player.playVideo();
    } catch {
      setError("無法控制播放，請改開 YouTube Music。");
    }
  }

  function selectPlaylist(next: YoutubePlaylist) {
    setPlaylistId(next.id);
    const player = playerRef.current;
    if (!player || !ready) return;
    try {
      loadMix(player, next);
      setError(null);
    } catch {
      setError("無法切換播放清單，請改開 YouTube Music。");
    }
  }

  return (
    <div
      data-playing={playing ? "true" : "false"}
      className={cn(
        "yt-music-hud",
        playing && "yt-music-hud--playing",
        hidden
          ? "pointer-events-none invisible absolute h-px w-px overflow-hidden opacity-0"
          : compact
            ? "pointer-events-auto w-fit max-w-[15.25rem] overflow-hidden rounded-2xl border border-red-400/20 bg-black/78 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl"
            : "pointer-events-auto w-fit max-w-[20rem] overflow-hidden rounded-2xl border border-red-400/20 bg-black/78 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl",
      )}
    >
      <div className={compact ? "flex items-center gap-2 px-2 py-1.5" : "flex items-start gap-2.5 px-2.5 py-2"}>
        <div
          className={
            compact
              ? "yt-music-mini relative size-9 shrink-0 overflow-hidden rounded-lg bg-zinc-900"
              : "yt-music-mini relative size-[3.5rem] shrink-0 overflow-hidden rounded-xl bg-zinc-900"
          }
        >
          <div ref={hostRef} className="h-full w-full" />
          {!ready ? (
            <div className="absolute inset-0 grid place-items-center bg-black/50">
              <Loader2 className="size-4 animate-spin text-red-300" />
            </div>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <div className="min-w-0 flex-1">
              {compact ? (
                <button
                  type="button"
                  onClick={() => onExpand?.()}
                  className="block w-full truncate text-left text-[10px] tracking-wide text-red-300/90 touch-manipulation"
                >
                  YouTube Music · 我的帳號
                </button>
              ) : (
                <p className="text-[10px] tracking-wide text-red-300/90">
                  YouTube Music · {playlist.hint}
                </p>
              )}
              <p className="truncate text-sm font-medium text-white">{title}</p>
              {compact ? null : (
                <p className="truncate text-[11px] text-zinc-400">{artist}</p>
              )}
            </div>
            <Button
              type="button"
              size="icon-sm"
              aria-label={playing ? "暫停" : "播放"}
              onClick={togglePlay}
              className="size-8 shrink-0 rounded-full bg-[#ff0033] text-white hover:bg-[#ff3357]"
            >
              {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5 fill-white" />}
            </Button>
            {compact ? (
              <a
                href={YOUTUBE_MUSIC_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="開啟我的 YouTube Music 帳號"
                title="連結既有 YouTube Music 帳號"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-300 hover:bg-white/10 hover:text-white"
              >
                <ExternalLink className="size-3.5" />
              </a>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="關閉播放器"
                onClick={onClose}
                className="size-8 text-zinc-300 hover:bg-white/10 hover:text-white"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
          {compact ? null : (
            <>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {catalog.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={item.id === playlist.id}
                    onClick={() => selectPlaylist(item)}
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] touch-manipulation",
                      item.id === playlist.id
                        ? "border-red-300/70 bg-[#ff0033]/35 text-white"
                        : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-zinc-400">
                {libraryMessage || statusMessage(libraryStatus)}
              </p>
              {libraryStatus === "connected" && playlists.length === 0 ? (
                <p className="mt-1 text-[11px] text-zinc-500">
                  YouTube Data API 無法提供私人 YouTube Music 曲庫，僅顯示可讀取播放清單。
                </p>
              ) : null}
              {libraryStatus !== "connected" && libraryStatus !== "loading" ? (
                <button
                  type="button"
                  onClick={() => onConnectLibrary?.()}
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/6 px-2 py-1 text-left text-[11px] text-zinc-200 hover:bg-white/10 touch-manipulation"
                >
                  {libraryStatus === "unconfigured"
                    ? "尚未設定，請先完成 Google OAuth"
                    : libraryStatus === "idle"
                      ? "先登入 Google，再授權 YouTube 歌單"
                      : libraryStatus === "unauthorized" || libraryStatus === "expired" || libraryStatus === "insufficient"
                        ? "授權 YouTube 播放清單"
                        : "重新授權 YouTube"}
                </button>
              ) : null}
              {error ? (
                <p className="mt-1 text-[11px] text-amber-200">{error}</p>
              ) : null}
              <div className="mt-1.5 flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="上一首"
                  onClick={() => playerRef.current?.previousVideo()}
                  className="size-8 text-zinc-200 hover:bg-white/10"
                >
                  <SkipBack className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="下一首"
                  onClick={() => playerRef.current?.nextVideo()}
                  className="size-8 text-zinc-200 hover:bg-white/10"
                >
                  <SkipForward className="size-4" />
                </Button>
                <a
                  href={YOUTUBE_MUSIC_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-zinc-400 hover:bg-white/8 hover:text-zinc-200"
                >
                  我的 YouTube Music
                  <ExternalLink className="size-3" />
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
