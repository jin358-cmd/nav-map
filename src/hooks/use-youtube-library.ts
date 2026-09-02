"use client";

import { useEffect, useState } from "react";
import type { YoutubePlaylist } from "@/lib/constants";
import { fetchYoutubeLibrary } from "@/lib/youtube-library";

type LibraryState = {
  token: string;
  playlists: YoutubePlaylist[];
  status: "ready" | "error";
};

export function useYoutubeLibrary(accessToken: string | null) {
  const [loaded, setLoaded] = useState<LibraryState | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    void fetchYoutubeLibrary(accessToken)
      .then((playlists) => {
        if (cancelled) return;
        setLoaded({ token: accessToken, playlists, status: "ready" });
      })
      .catch(() => {
        if (cancelled) return;
        setLoaded({ token: accessToken, playlists: [], status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  if (!accessToken) {
    return { playlists: [] as YoutubePlaylist[], status: "idle" as const };
  }
  if (!loaded || loaded.token !== accessToken) {
    return { playlists: [] as YoutubePlaylist[], status: "loading" as const };
  }
  return { playlists: loaded.playlists, status: loaded.status };
}
