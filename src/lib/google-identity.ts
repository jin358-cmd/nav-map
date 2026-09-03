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
export const GOOGLE_ACCESS_STORAGE_KEY = "navpilot.google-access.v1";
export const GOOGLE_ACCESS_EVENT = "navpilot-google-access";
export const YOUTUBE_TOKEN_STORAGE_KEY = "navpilot.youtube-token.v1";
export const YOUTUBE_TOKEN_EVENT = "navpilot-youtube-token";
export const YOUTUBE_READONLY_SCOPE =
  "https://www.googleapis.com/auth/youtube.readonly";
export const DRIVE_APPDATA_SCOPE =
  "https://www.googleapis.com/auth/drive.appdata";
export const GOOGLE_LOGIN_SCOPES = [
  "openid",
  "email",
  "profile",
  DRIVE_APPDATA_SCOPE,
].join(" ");
export const YOUTUBE_SCOPES = YOUTUBE_READONLY_SCOPE;

export type ScopedAccess = {
  accessToken: string;
  exp: number;
  scopes: string;
};

export type YoutubeAccess = ScopedAccess;

export function hasScope(scopes: string | undefined, needed: string) {
  return (scopes ?? "").split(/\s+/).includes(needed);
}

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

export function isAccessFresh(access: ScopedAccess, skewMs = 60_000) {
  return access.exp > Date.now() + skewMs;
}

export function isYoutubeAccessFresh(access: YoutubeAccess, skewMs = 60_000) {
  return isAccessFresh(access, skewMs) && hasScope(access.scopes, YOUTUBE_READONLY_SCOPE);
}

function readScopedAccess(key: string): ScopedAccess | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ScopedAccess;
    if (!parsed?.accessToken || !parsed.exp) return null;
    return isAccessFresh(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeScopedAccess(key: string, eventName: string, access: ScopedAccess | null) {
  if (typeof window === "undefined") return;
  try {
    if (!access) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, JSON.stringify(access));
  } catch {
    /* 私人模式可能擋 sessionStorage */
  }
  window.dispatchEvent(new Event(eventName));
}

export function readGoogleAccess(): ScopedAccess | null {
  return readScopedAccess(GOOGLE_ACCESS_STORAGE_KEY);
}

export function writeGoogleAccess(access: ScopedAccess | null) {
  writeScopedAccess(GOOGLE_ACCESS_STORAGE_KEY, GOOGLE_ACCESS_EVENT, access);
}

export function readYoutubeAccess(): YoutubeAccess | null {
  const access = readScopedAccess(YOUTUBE_TOKEN_STORAGE_KEY);
  if (!access) return null;
  return hasScope(access.scopes, YOUTUBE_READONLY_SCOPE) ? access : null;
}

export function writeYoutubeAccess(access: YoutubeAccess | null) {
  writeScopedAccess(YOUTUBE_TOKEN_STORAGE_KEY, YOUTUBE_TOKEN_EVENT, access);
}

export async function fetchGoogleProfile(
  accessToken: string,
  expiresIn = 3600,
): Promise<GoogleAccount | null> {
  try {
    const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const profile = (await response.json()) as {
      sub?: string;
      name?: string;
      email?: string;
      picture?: string;
    };
    if (!profile.sub) return null;
    return {
      sub: profile.sub,
      name: profile.name?.trim() || profile.email?.split("@")[0] || "Google 帳號",
      email: profile.email?.trim() || "",
      picture: profile.picture?.trim() || "",
      idToken: accessToken,
      exp: Math.floor((Date.now() + expiresIn * 1000) / 1000),
    };
  } catch {
    return null;
  }
}

const GSI_SRC = "https://accounts.google.com/gsi/client";
let gsiLoadPromise: Promise<void> | null = null;

function gsiReady() {
  return Boolean(window.google?.accounts?.oauth2);
}

export function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (gsiReady()) return Promise.resolve();
  if (gsiLoadPromise) return gsiLoadPromise;

  gsiLoadPromise = new Promise((resolve, reject) => {
    const finish = () => {
      if (gsiReady()) {
        resolve();
        return;
      }
      gsiLoadPromise = null;
      reject(new Error("gsi"));
    };
    const fail = () => {
      gsiLoadPromise = null;
      reject(new Error("gsi"));
    };

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GSI_SRC}"]`,
    );
    if (existing) {
      if (existing.dataset.loaded === "true" || gsiReady()) {
        finish();
        return;
      }
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", fail, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      finish();
    };
    script.onerror = fail;
    document.head.appendChild(script);
  });

  return gsiLoadPromise;
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
            include_granted_scopes?: boolean;
            hint?: string;
            callback: (response: {
              access_token?: string;
              expires_in?: number;
              scope?: string;
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
