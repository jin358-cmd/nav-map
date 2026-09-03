"use client";

import { useEffect, useState } from "react";
import { GOOGLE_CLIENT_ID } from "@/lib/google-identity";
import {
  fetchYoutubeLibrary,
  statusMessage,
  type YoutubeLibraryResult,
  type YoutubeLibraryStatus,
} from "@/lib/youtube-library";
import type { YoutubePlaylist } from "@/lib/constants";

export function useYoutubeLibrary(
  accessToken: string | null,
  signedIn: boolean,
) {
  const [loaded, setLoaded] = useState<YoutubeLibraryResult | null>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !accessToken) {
      setLoaded(null);
      return;
    }
    let cancelled = false;
    void fetchYoutubeLibrary(accessToken).then((result) => {
      if (!cancelled) setLoaded(result);
    });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  if (!GOOGLE_CLIENT_ID) {
    return empty("unconfigured");
  }
  if (!signedIn) {
    return empty("idle");
  }
  if (!accessToken) {
    return empty("unauthorized");
  }
  if (!loaded || loaded.status === "loading") {
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
