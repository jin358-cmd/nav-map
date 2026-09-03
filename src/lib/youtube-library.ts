import type { YoutubePlaylist } from "@/lib/constants";

const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";
const MAX_PLAYLISTS = 12;
const MAX_ITEMS = 20;

export type YoutubeLibraryStatus =
  | "unconfigured"
  | "unauthorized"
  | "loading"
  | "connected"
  | "insufficient"
  | "api-disabled"
  | "failed"
  | "expired"
  | "idle";

export type YoutubeLibraryResult = {
  playlists: YoutubePlaylist[];
  status: YoutubeLibraryStatus;
  message: string;
};

type PlaylistListResponse = {
  items?: {
    id?: string;
    snippet?: { title?: string };
    contentDetails?: { itemCount?: number };
  }[];
  error?: { errors?: { reason?: string }[]; message?: string };
};

type ChannelListResponse = {
  items?: {
    contentDetails?: {
      relatedPlaylists?: { likes?: string };
    };
  }[];
  error?: { errors?: { reason?: string }[]; message?: string };
};

type PlaylistItemsResponse = {
  items?: { contentDetails?: { videoId?: string } }[];
  error?: { errors?: { reason?: string }[]; message?: string };
};

function classifyYoutubeError(status: number, reason: string, message: string): YoutubeLibraryStatus {
  const blob = `${reason} ${message}`.toLowerCase();
  if (status === 401 || blob.includes("autherror") || blob.includes("expired")) return "expired";
  if (blob.includes("accessnotconfigured") || blob.includes("youtube data api")) return "api-disabled";
  if (
    blob.includes("insufficient") ||
    blob.includes("forbidden") ||
    blob.includes("youtubesignuprequired") ||
    status === 403
  ) {
    return "insufficient";
  }
  return "failed";
}

async function youtubeGet<T extends { error?: { errors?: { reason?: string }[]; message?: string } }>(
  path: string,
  token: string,
): Promise<{ data: T | null; status: number; reason: string; message: string }> {
  try {
    const response = await fetch(`${YOUTUBE_API}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const json = (await response.json().catch(() => ({}))) as T;
    const reason = json.error?.errors?.[0]?.reason ?? "";
    const message = json.error?.message ?? "";
    if (!response.ok) {
      return { data: null, status: response.status, reason, message };
    }
    return { data: json, status: response.status, reason, message };
  } catch {
    return { data: null, status: 0, reason: "", message: "network" };
  }
}

async function fetchVideoIds(token: string, playlistId: string) {
  const result = await youtubeGet<PlaylistItemsResponse>(
    `/playlistItems?part=contentDetails&playlistId=${encodeURIComponent(playlistId)}&maxResults=${MAX_ITEMS}`,
    token,
  );
  return (result.data?.items ?? [])
    .map((item) => item.contentDetails?.videoId)
    .filter((id): id is string => Boolean(id));
}

export async function fetchYoutubeLibrary(
  accessToken: string,
): Promise<YoutubeLibraryResult> {
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

  if (!channels.data && !lists.data) {
    const failed = channels.status ? channels : lists;
    const status = classifyYoutubeError(failed.status, failed.reason, failed.message);
    return {
      playlists: [],
      status,
      message: statusMessage(status),
    };
  }

  const candidates: { id: string; title: string; hint: string }[] = [];
  const likes = channels.data?.items?.[0]?.contentDetails?.relatedPlaylists?.likes;
  if (likes) {
    candidates.push({ id: likes, title: "喜歡的影片", hint: "YouTube 公開／未隱藏清單" });
  }

  for (const item of lists.data?.items ?? []) {
    if (!item.id) continue;
    if ((item.contentDetails?.itemCount ?? 0) < 1) continue;
    if (candidates.some((entry) => entry.id === item.id)) continue;
    candidates.push({
      id: item.id,
      title: item.snippet?.title?.trim() || "未命名歌單",
      hint: "YouTube 播放清單",
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
  const playlists = resolved.filter((item) => item !== null);
  return {
    playlists,
    status: "connected",
    message:
      playlists.length > 0
        ? "已連線。僅能讀取 YouTube Data API 提供的播放清單，不含私人 YouTube Music 曲庫。"
        : "已連線，但這個帳號沒有可讀取的播放清單。",
  };
}

export function statusMessage(status: YoutubeLibraryStatus) {
  if (status === "unconfigured") return "尚未設定 Google Client ID。";
  if (status === "unauthorized") return "尚未授權 YouTube 播放清單。";
  if (status === "loading") return "正在載入播放清單…";
  if (status === "connected") return "已連線";
  if (status === "insufficient") return "權限不足，請重新授權 YouTube。";
  if (status === "api-disabled") return "專案尚未啟用 YouTube Data API。";
  if (status === "expired") return "授權已過期，請重新授權。";
  if (status === "failed") return "登入失敗或無法載入播放清單。";
  return "尚未連線 YouTube。";
}
