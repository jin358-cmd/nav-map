export type GoogleAccount = {
  sub: string;
  name: string;
  email: string;
  picture: string;
  idToken: string;
  exp: number;
};

export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? "";

export const GOOGLE_ACCOUNT_STORAGE_KEY = "navpilot.google.v1";
export const GOOGLE_ACCOUNT_EVENT = "navpilot-google-account";
export const YOUTUBE_TOKEN_STORAGE_KEY = "navpilot.youtube-token.v1";
export const YOUTUBE_TOKEN_EVENT = "navpilot-youtube-token";
export const YOUTUBE_READONLY_SCOPE =
  "https://www.googleapis.com/auth/youtube.readonly";

export type YoutubeAccess = {
  accessToken: string;
  exp: number;
};

type JwtPayload = {
  sub?: string;
  name?: string;
  email?: string;
  picture?: string;
  exp?: number;
};

export function decodeIdToken(idToken: string): GoogleAccount | null {
  const payloadPart = idToken.split(".")[1];
  if (!payloadPart) return null;
  try {
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded)) as JwtPayload;
    if (!payload.sub || !payload.exp) return null;
    return {
      sub: payload.sub,
      name: payload.name?.trim() || payload.email?.split("@")[0] || "Google 帳號",
      email: payload.email?.trim() || "",
      picture: payload.picture?.trim() || "",
      idToken,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

export function isAccountFresh(account: GoogleAccount, skewSeconds = 60) {
  return account.exp * 1000 > Date.now() + skewSeconds * 1000;
}

export function readStoredAccount(): GoogleAccount | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(GOOGLE_ACCOUNT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GoogleAccount;
    if (!parsed?.sub || !parsed.idToken || !parsed.exp) return null;
    return isAccountFresh(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeStoredAccount(account: GoogleAccount | null) {
  if (typeof window === "undefined") return;
  try {
    if (!account) {
      window.sessionStorage.removeItem(GOOGLE_ACCOUNT_STORAGE_KEY);
    } else {
      window.sessionStorage.setItem(
        GOOGLE_ACCOUNT_STORAGE_KEY,
        JSON.stringify(account),
      );
    }
  } catch {
    /* 私人模式可能擋 sessionStorage */
  }
  window.dispatchEvent(new Event(GOOGLE_ACCOUNT_EVENT));
}

export function isYoutubeAccessFresh(access: YoutubeAccess, skewMs = 60_000) {
  return access.exp > Date.now() + skewMs;
}

export function readYoutubeAccess(): YoutubeAccess | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(YOUTUBE_TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as YoutubeAccess;
    if (!parsed?.accessToken || !parsed.exp) return null;
    return isYoutubeAccessFresh(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeYoutubeAccess(access: YoutubeAccess | null) {
  if (typeof window === "undefined") return;
  try {
    if (!access) {
      window.sessionStorage.removeItem(YOUTUBE_TOKEN_STORAGE_KEY);
    } else {
      window.sessionStorage.setItem(
        YOUTUBE_TOKEN_STORAGE_KEY,
        JSON.stringify(access),
      );
    }
  } catch {
    /* 私人模式可能擋 sessionStorage */
  }
  window.dispatchEvent(new Event(YOUTUBE_TOKEN_EVENT));
}

export function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.id && window.google.accounts.oauth2) {
    return Promise.resolve();
  }
  const existing = document.querySelector<HTMLScriptElement>(
    'script[src="https://accounts.google.com/gsi/client"]',
  );
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("gsi")), {
        once: true,
      });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("gsi"));
    document.head.appendChild(script);
  });
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            use_fedcm_for_prompt?: boolean;
          }) => void;
          prompt: (callback?: (notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: string;
              theme?: string;
              size?: string;
              text?: string;
              shape?: string;
              locale?: string;
              width?: number;
            },
          ) => void;
          disableAutoSelect: () => void;
          revoke: (hint: string, done: () => void) => void;
        };
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: {
              access_token?: string;
              expires_in?: number;
              error?: string;
            }) => void;
            error_callback?: (error: { type?: string; message?: string }) => void;
          }) => {
            requestAccessToken: (override?: { prompt?: "" | "consent" | "select_account" }) => void;
          };
          revoke: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}
