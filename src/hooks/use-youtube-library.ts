"use client";

import { useEffect, useState } from "react";
import type { YoutubePlaylist } from "@/lib/constants";
import {
  fetchYoutubeLibrary,
  statusMessage,
  type YoutubeLibraryResult,
  type YoutubeLibraryStatus,
} from "@/lib/youtube-library";

export function useYoutubeLibrary(
  accessToken: string | null,
  signedIn: boolean,
) {
  const [loaded, setLoaded] = useState<(YoutubeLibraryResult & { token: string }) | null>(
    null,
  );

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    void fetchYoutubeLibrary(accessToken).then((result) => {
      if (!cancelled) setLoaded({ ...result, token: accessToken });
    });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  if (!signedIn) {
    return empty("idle");
  }
  if (!accessToken) {
    return empty("unauthorized");
  }
  if (!loaded || loaded.token !== accessToken) {
    return empty("loading");
  }
  return {
    playlists: loaded.playlists,
    status: loaded.status,
    message: loaded.message || statusMessage(loaded.status),
  };
}

function empty(status: YoutubeLibraryStatus): {
  playlists: YoutubePlaylist[];
  status: YoutubeLibraryStatus;
  message: string;
} {
  return { playlists: [], status, message: statusMessage(status) };
}
