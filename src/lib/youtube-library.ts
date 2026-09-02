import type { YoutubePlaylist } from "@/lib/constants";

const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";
const MAX_PLAYLISTS = 12;
const MAX_ITEMS = 20;

type PlaylistListResponse = {
  items?: {
    id?: string;
    snippet?: { title?: string };
    contentDetails?: { itemCount?: number };
  }[];
};

type ChannelListResponse = {
  items?: {
    contentDetails?: {
      relatedPlaylists?: { likes?: string };
    };
  }[];
};

type PlaylistItemsResponse = {
  items?: { contentDetails?: { videoId?: string } }[];
};

async function youtubeGet<T>(path: string, token: string): Promise<T | null> {
  try {
    const response = await fetch(`${YOUTUBE_API}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function fetchVideoIds(token: string, playlistId: string) {
  const data = await youtubeGet<PlaylistItemsResponse>(
    `/playlistItems?part=contentDetails&playlistId=${encodeURIComponent(playlistId)}&maxResults=${MAX_ITEMS}`,
    token,
  );
  return (data?.items ?? [])
    .map((item) => item.contentDetails?.videoId)
    .filter((id): id is string => Boolean(id));
}

export async function fetchYoutubeLibrary(
  accessToken: string,
): Promise<YoutubePlaylist[]> {
  const [channels, lists] = await Promise.all([
    youtubeGet<ChannelListResponse>(
      "/channels?part=contentDetails&mine=true",
      accessToken,
    ),
    youtubeGet<PlaylistListResponse>(
      `/playlists?part=snippet,contentDetails&mine=true&maxResults=25`,
      accessToken,
    ),
  ]);

  const candidates: { id: string; title: string; hint: string }[] = [];
  const likes = channels?.items?.[0]?.contentDetails?.relatedPlaylists?.likes;
  if (likes) {
    candidates.push({ id: likes, title: "喜歡的音樂", hint: "YouTube Music" });
  }

  for (const item of lists?.items ?? []) {
    if (!item.id) continue;
    if ((item.contentDetails?.itemCount ?? 0) < 1) continue;
    if (candidates.some((entry) => entry.id === item.id)) continue;
    candidates.push({
      id: item.id,
      title: item.snippet?.title?.trim() || "未命名歌單",
      hint: "已儲存歌單",
    });
    if (candidates.length >= MAX_PLAYLISTS) break;
  }

  const resolved = await Promise.all(
    candidates.map(async (item) => {
      const videoIds = await fetchVideoIds(accessToken, item.id);
      if (videoIds.length === 0) return null;
      const playlist: YoutubePlaylist = {
        id: item.id,
        label: item.title,
        hint: item.hint,
        videoIds,
        youtubeListId: item.id,
      };
      return playlist;
    }),
  );
  return resolved.filter((item) => item !== null);
}
