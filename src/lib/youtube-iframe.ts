type YouTubePlayerCtor = new (
  element: HTMLElement | string,
  options: {
    width?: number | string;
    height?: number | string;
    videoId?: string;
    playerVars?: Record<string, string | number>;
    events?: {
      onReady?: (event: { target: YouTubePlayer }) => void;
      onStateChange?: (event: { data: number; target: YouTubePlayer }) => void;
      onError?: (event: { data: number; target: YouTubePlayer }) => void;
    };
  },
) => YouTubePlayer;

export type YouTubePlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  nextVideo: () => void;
  previousVideo: () => void;
  getPlayerState: () => number;
  getVideoData: () => { title?: string; author?: string; video_id?: string };
  destroy: () => void;
};

declare global {
  interface Window {
    YT?: { Player: YouTubePlayerCtor; PlayerState?: { PLAYING: number; PAUSED: number } };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const YT_PLAYING = 1;
export const YT_PAUSED = 2;

let apiPromise: Promise<YouTubePlayerCtor> | null = null;

export function loadYouTubeIframeApi(): Promise<YouTubePlayerCtor> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube API 僅能在瀏覽器載入"));
  }
  if (window.YT?.Player) return Promise.resolve(window.YT.Player);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    const done = () => {
      if (window.YT?.Player) resolve(window.YT.Player);
      else reject(new Error("YouTube 播放器載入失敗"));
    };
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      done();
    };
    if (!document.getElementById("youtube-iframe-api")) {
      const script = document.createElement("script");
      script.id = "youtube-iframe-api";
      script.src = "https://www.youtube.com/iframe_api";
      script.onerror = () => {
        apiPromise = null;
        reject(new Error("無法連線 YouTube"));
      };
      document.head.appendChild(script);
    }
  });

  return apiPromise;
}
