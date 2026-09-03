"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { pushDriveFavorites, syncDriveFavorites } from "@/lib/drive-bookmarks";
import { getFavoritesSnapshot, subscribeFavorites } from "@/lib/favorites";
import {
  GOOGLE_ACCESS_EVENT,
  GOOGLE_ACCOUNT_EVENT,
  GOOGLE_CLIENT_ID,
  GOOGLE_LOGIN_SCOPES,
  YOUTUBE_READONLY_SCOPE,
  YOUTUBE_SCOPES,
  YOUTUBE_TOKEN_EVENT,
  fetchGoogleProfile,
  hasScope,
  loadGoogleIdentityScript,
  readGoogleAccess,
  readStoredAccount,
  readYoutubeAccess,
  writeGoogleAccess,
  writeStoredAccount,
  writeYoutubeAccess,
  type GoogleAccount,
  type ScopedAccess,
} from "@/lib/google-identity";

function subscribeAccount(onChange: () => void) {
  window.addEventListener(GOOGLE_ACCOUNT_EVENT, onChange);
  return () => window.removeEventListener(GOOGLE_ACCOUNT_EVENT, onChange);
}

function subscribeGoogleAccess(onChange: () => void) {
  window.addEventListener(GOOGLE_ACCESS_EVENT, onChange);
  return () => window.removeEventListener(GOOGLE_ACCESS_EVENT, onChange);
}

function subscribeYoutube(onChange: () => void) {
  window.addEventListener(YOUTUBE_TOKEN_EVENT, onChange);
  return () => window.removeEventListener(YOUTUBE_TOKEN_EVENT, onChange);
}

let warnedMissingClientId = false;

export type GoogleTokenReason =
  | "ok"
  | "cancel"
  | "error"
  | "unconfigured"
  | "origin"
  | "popup";

export function useGoogleAccount() {
  const account = useSyncExternalStore(
    subscribeAccount,
    readStoredAccount,
    () => null,
  );
  const googleAccess = useSyncExternalStore(
    subscribeGoogleAccess,
    readGoogleAccess,
    () => null,
  );
  const youtubeAccess = useSyncExternalStore(
    subscribeYoutube,
    readYoutubeAccess,
    () => null,
  );
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [sdkStatus, setSdkStatus] = useState<"idle" | "loading" | "ready" | "error">(
    GOOGLE_CLIENT_ID ? "loading" : "idle",
  );
  const accountRef = useRef<GoogleAccount | null>(account);
  const configured = Boolean(GOOGLE_CLIENT_ID);

  useEffect(() => {
    accountRef.current = account;
  }, [account]);

  useEffect(() => {
    if (!configured) {
      if (process.env.NODE_ENV === "development" && !warnedMissingClientId) {
        warnedMissingClientId = true;
        console.warn("Google OAuth client ID is missing.");
      }
      return;
    }
    let cancelled = false;
    void loadGoogleIdentityScript()
      .then(() => {
        if (!cancelled) setSdkStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setSdkStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [configured]);

  const applyAccount = useCallback((next: GoogleAccount | null) => {
    accountRef.current = next;
    writeStoredAccount(next);
  }, []);

  const requestGoogleAccess = useCallback((
    scope: string,
    prompt: "" | "consent" | "select_account" = "consent",
  ) => {
    if (!GOOGLE_CLIENT_ID) {
      return Promise.resolve({ token: null, scopes: "", reason: "unconfigured" as const });
    }
    return loadGoogleIdentityScript().then(
      () =>
        new Promise<{
          token: string | null;
          scopes: string;
          reason: GoogleTokenReason;
        }>((resolve) => {
          const oauth = window.google?.accounts?.oauth2;
          if (!oauth) {
            resolve({ token: null, scopes: "", reason: "error" });
            return;
          }
          const client = oauth.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope,
            include_granted_scopes: true,
            hint: accountRef.current?.email,
            callback: (response) => {
              if (!response.access_token) {
                resolve({ token: null, scopes: "", reason: "error" });
                return;
              }
              const scopes = response.scope || scope;
              const access: ScopedAccess = {
                accessToken: response.access_token,
                exp: Date.now() + (response.expires_in ?? 3600) * 1000,
                scopes,
              };
              writeGoogleAccess(access);
              if (hasScope(scopes, YOUTUBE_READONLY_SCOPE)) {
                writeYoutubeAccess(access);
              }
              resolve({ token: response.access_token, scopes, reason: "ok" });
            },
            error_callback: (error) => {
              const type = `${error.type ?? ""} ${error.message ?? ""}`.toLowerCase();
              if (type.includes("popup_closed") || type.includes("popup_failed")) {
                resolve({ token: null, scopes: "", reason: "popup" });
                return;
              }
              if (type.includes("origin")) {
                resolve({ token: null, scopes: "", reason: "origin" });
                return;
              }
              if (type.includes("popup") || type.includes("closed")) {
                resolve({ token: null, scopes: "", reason: "cancel" });
                return;
              }
              resolve({ token: null, scopes: "", reason: "error" });
            },
          });
          client.requestAccessToken({ prompt });
        }),
    );
  }, []);

  const signIn = useCallback(() => {
    if (!configured) {
      setHint("Google 登入尚未完成設定");
      return;
    }
    if (sdkStatus === "error") {
      setHint("目前無法連線 Google 登入，請稍後再試。");
      return;
    }
    setBusy(true);
    setHint(null);
    void requestGoogleAccess(GOOGLE_LOGIN_SCOPES, "consent")
      .then(async ({ token, reason }) => {
        if (!token) {
          if (reason === "cancel" || reason === "popup") setHint("已取消登入。");
          else if (reason === "origin") setHint("登入網域尚未加入 Google Authorized Origins。");
          else setHint("登入沒有完成，請再試一次。");
          return;
        }
        const profile = await fetchGoogleProfile(token);
        if (!profile) {
          setHint("無法確認 Google 帳號，請再試一次。");
          return;
        }
        applyAccount(profile);
        await syncDriveFavorites(token);
        setHint("已登入，書籤會存到你的 Google 帳號。");
      })
      .catch(() => {
        setHint("目前無法連線 Google 登入，請稍後再試。");
      })
      .finally(() => setBusy(false));
  }, [applyAccount, configured, requestGoogleAccess, sdkStatus]);

  const connectYoutube = useCallback(async () => {
    if (!configured) {
      setHint("Google 登入尚未完成設定");
      return null;
    }
    if (!accountRef.current) {
      setHint("請先登入 Google 帳號，再授權 YouTube 歌單。");
      signIn();
      return null;
    }
    const existing = readYoutubeAccess();
    if (existing?.accessToken) return existing.accessToken;
    setBusy(true);
    const { token, scopes, reason } = await requestGoogleAccess(
      YOUTUBE_SCOPES,
      "consent",
    );
    setBusy(false);
    if (!token) {
      if (reason === "cancel" || reason === "popup") setHint("已取消 YouTube 授權。");
      else if (reason === "origin") setHint("登入網域尚未加入 Google Authorized Origins。");
      else setHint("無法取得 YouTube 授權，請再試一次。");
      return null;
    }
    if (!hasScope(scopes, YOUTUBE_READONLY_SCOPE)) {
      setHint("這個帳號尚未授權 YouTube 播放清單權限。");
      writeYoutubeAccess(null);
      return null;
    }
    setHint(null);
    return token;
  }, [configured, requestGoogleAccess, signIn]);

  useEffect(() => {
    if (!account) return;
    let timer = 0;
    const push = () => {
      const token = readGoogleAccess()?.accessToken ?? null;
      if (!token || !accountRef.current) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void pushDriveFavorites(token, getFavoritesSnapshot()).catch(
          () => undefined,
        );
      }, 400);
    };
    const unsubscribe = subscribeFavorites(push);
    push();
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [account, googleAccess]);

  const signOut = useCallback(() => {
    const current = accountRef.current;
    if (current?.email && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.disableAutoSelect();
        window.google.accounts.id.revoke(current.email, () => undefined);
      } catch {
        /* revoke 失敗仍清本機登入 */
      }
    }
    const google = readGoogleAccess();
    const youtube = readYoutubeAccess();
    if (google?.accessToken && window.google?.accounts?.oauth2) {
      try {
        window.google.accounts.oauth2.revoke(google.accessToken, () => undefined);
      } catch {
        /* revoke 失敗仍清本機權杖 */
      }
    } else if (youtube?.accessToken && window.google?.accounts?.oauth2) {
      try {
        window.google.accounts.oauth2.revoke(youtube.accessToken, () => undefined);
      } catch {
        /* revoke 失敗仍清本機權杖 */
      }
    }
    writeYoutubeAccess(null);
    writeGoogleAccess(null);
    applyAccount(null);
    setHint("已登出。書籤仍留在此裝置。");
  }, [applyAccount]);

  return {
    account,
    ready: true,
    busy: busy || sdkStatus === "loading",
    hint,
    configured,
    unavailable: !configured || sdkStatus === "error",
    sdkStatus,
    youtubeAccessToken: youtubeAccess?.accessToken ?? null,
    youtubeAuthorized: Boolean(youtubeAccess?.accessToken),
    signIn,
    signOut,
    connectYoutube,
    dismissHint: () => setHint(null),
  };
}
