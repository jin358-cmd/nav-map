"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { pushDriveFavorites, syncDriveFavorites } from "@/lib/drive-bookmarks";
import { getFavoritesSnapshot, subscribeFavorites } from "@/lib/favorites";
import {
  GOOGLE_ACCOUNT_EVENT,
  GOOGLE_CLIENT_ID,
  GOOGLE_LOGIN_SCOPES,
  YOUTUBE_TOKEN_EVENT,
  fetchGoogleProfile,
  loadGoogleIdentityScript,
  readStoredAccount,
  readYoutubeAccess,
  writeStoredAccount,
  writeYoutubeAccess,
  type GoogleAccount,
} from "@/lib/google-identity";

function subscribeAccount(onChange: () => void) {
  window.addEventListener(GOOGLE_ACCOUNT_EVENT, onChange);
  return () => window.removeEventListener(GOOGLE_ACCOUNT_EVENT, onChange);
}

function subscribeYoutube(onChange: () => void) {
  window.addEventListener(YOUTUBE_TOKEN_EVENT, onChange);
  return () => window.removeEventListener(YOUTUBE_TOKEN_EVENT, onChange);
}

function driveToken() {
  return readYoutubeAccess()?.accessToken ?? null;
}

export function useGoogleAccount() {
  const account = useSyncExternalStore(
    subscribeAccount,
    readStoredAccount,
    () => null,
  );
  const youtubeAccess = useSyncExternalStore(
    subscribeYoutube,
    readYoutubeAccess,
    () => null,
  );
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const accountRef = useRef<GoogleAccount | null>(account);

  useEffect(() => {
    accountRef.current = account;
  }, [account]);

  const applyAccount = useCallback((next: GoogleAccount | null) => {
    accountRef.current = next;
    writeStoredAccount(next);
  }, []);

  const requestGoogleAccess = useCallback((prompt: "" | "consent" = "consent") => {
    if (!GOOGLE_CLIENT_ID) return Promise.resolve(null);
    return loadGoogleIdentityScript().then(
      () =>
        new Promise<string | null>((resolve) => {
          const oauth = window.google?.accounts?.oauth2;
          if (!oauth) {
            resolve(null);
            return;
          }
          const client = oauth.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: GOOGLE_LOGIN_SCOPES,
            callback: (response) => {
              if (!response.access_token) {
                resolve(null);
                return;
              }
              writeYoutubeAccess({
                accessToken: response.access_token,
                exp: Date.now() + (response.expires_in ?? 3600) * 1000,
              });
              resolve(response.access_token);
            },
            error_callback: () => resolve(null),
          });
          client.requestAccessToken({ prompt });
        }),
    );
  }, []);

  const signIn = useCallback(() => {
    if (!GOOGLE_CLIENT_ID) {
      setHint("請在 .env.local 設定 NEXT_PUBLIC_GOOGLE_CLIENT_ID 後重新啟動。");
      return;
    }
    setBusy(true);
    setHint(null);
    void requestGoogleAccess("consent")
      .then(async (token) => {
        if (!token) {
          setHint("請允許彈出視窗並授權 Google，才能把書籤存進你的帳號。");
          return;
        }
        const profile = await fetchGoogleProfile(token);
        if (!profile) {
          setHint("無法讀取 Google 帳號，請再試一次。");
          return;
        }
        applyAccount(profile);
        await syncDriveFavorites(token);
        setHint("書籤已同步到你的 Google 帳號。");
      })
      .catch(() => {
        setHint("無法載入 Google 登入。");
      })
      .finally(() => setBusy(false));
  }, [applyAccount, requestGoogleAccess]);

  const connectYoutube = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID) {
      setHint("尚未設定 Google 登入，無法同步 YouTube Music 歌單。");
      return null;
    }
    if (!accountRef.current) {
      setHint("請先登入 Google 帳號。");
      signIn();
      return null;
    }
    setBusy(true);
    const token = await requestGoogleAccess(readYoutubeAccess() ? "" : "consent");
    setBusy(false);
    if (!token) {
      setHint("請允許 YouTube 讀取權限，才能同步已儲存歌單。");
      return null;
    }
    setHint(null);
    return token;
  }, [requestGoogleAccess, signIn]);

  useEffect(() => {
    if (!account) return;
    let timer = 0;
    const push = () => {
      const token = driveToken();
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
  }, [account]);

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
    const youtube = readYoutubeAccess();
    if (youtube?.accessToken && window.google?.accounts?.oauth2) {
      try {
        window.google.accounts.oauth2.revoke(youtube.accessToken, () => undefined);
      } catch {
        /* revoke 失敗仍清本機權杖 */
      }
    }
    writeYoutubeAccess(null);
    applyAccount(null);
    setHint("已登出。書籤仍留在此裝置，下次登入會再同步到 Google。");
  }, [applyAccount]);

  return {
    account,
    ready: true,
    busy,
    hint,
    configured: Boolean(GOOGLE_CLIENT_ID),
    youtubeAccessToken: youtubeAccess?.accessToken ?? null,
    signIn,
    signOut,
    connectYoutube,
    dismissHint: () => setHint(null),
  };
}
