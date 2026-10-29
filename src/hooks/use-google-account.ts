"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { pushDriveFavorites, syncDriveFavorites } from "@/lib/drive-bookmarks";
import { getFavoritesSnapshot, subscribeFavorites } from "@/lib/favorites";
import {
  GOOGLE_ACCESS_EVENT,
  GOOGLE_ACCOUNT_EVENT,
  GOOGLE_CLIENT_ID_EVENT,
  GOOGLE_LOGIN_SCOPES,
  YOUTUBE_READONLY_SCOPE,
  YOUTUBE_SCOPES,
  YOUTUBE_TOKEN_EVENT,
  fetchGoogleProfile,
  getGoogleClientId,
  hasScope,
  loadGoogleIdentityScript,
  readGoogleAccess,
  readStoredAccount,
  readYoutubeAccess,
  resolveGoogleClientId,
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
  const [clientId, setClientId] = useState(getGoogleClientId);
  const [configReady, setConfigReady] = useState(() => Boolean(getGoogleClientId()));
  const [sdkStatus, setSdkStatus] = useState<"idle" | "loading" | "ready" | "error">(
    getGoogleClientId() ? "loading" : "idle",
  );
  const accountRef = useRef<GoogleAccount | null>(account);
  const configured = Boolean(clientId);

  useEffect(() => {
    accountRef.current = account;
  }, [account]);

  useEffect(() => {
    const sync = () => setClientId(getGoogleClientId());
    window.addEventListener(GOOGLE_CLIENT_ID_EVENT, sync);
    void resolveGoogleClientId().then((id) => {
      setClientId(id);
      setConfigReady(true);
    });
    return () => window.removeEventListener(GOOGLE_CLIENT_ID_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!configured) {
      if (process.env.NODE_ENV === "development" && configReady && !warnedMissingClientId) {
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
  }, [configured, configReady]);

  const applyAccount = useCallback((next: GoogleAccount | null) => {
    accountRef.current = next;
    writeStoredAccount(next);
  }, []);

  const openGoogleConsent = useCallback((
    scope: string,
    prompt: "" | "consent" | "select_account",
  ) => {
    const oauthClientId = getGoogleClientId();
    const oauth = window.google?.accounts?.oauth2;
    if (!oauthClientId) {
      return Promise.resolve({
        token: null as string | null,
        scopes: "",
        reason: "unconfigured" as const,
        expiresIn: 3600,
      });
    }
    if (!oauth) {
      return Promise.resolve({
        token: null as string | null,
        scopes: "",
        reason: "error" as const,
        expiresIn: 3600,
      });
    }
    return new Promise<{
      token: string | null;
      scopes: string;
      reason: GoogleTokenReason;
      expiresIn: number;
    }>((resolve) => {
      let settled = false;
      const finish = (value: {
        token: string | null;
        scopes: string;
        reason: GoogleTokenReason;
        expiresIn: number;
      }) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const client = oauth.initTokenClient({
        client_id: oauthClientId,
        scope,
        include_granted_scopes: true,
        hint: accountRef.current?.email,
        callback: (response) => {
          if (response.error || !response.access_token) {
            finish({ token: null, scopes: "", reason: "error", expiresIn: 3600 });
            return;
          }
          const scopes = response.scope || scope;
          const expiresIn = response.expires_in ?? 3600;
          const access: ScopedAccess = {
            accessToken: response.access_token,
            exp: Date.now() + expiresIn * 1000,
            scopes,
          };
          writeGoogleAccess(access);
          if (hasScope(scopes, YOUTUBE_READONLY_SCOPE)) {
            writeYoutubeAccess(access);
          }
          finish({
            token: response.access_token,
            scopes,
            reason: "ok",
            expiresIn,
          });
        },
        error_callback: (error) => {
          const type = `${error.type ?? ""} ${error.message ?? ""}`.toLowerCase();
          if (type.includes("popup_closed") || type.includes("popup_failed")) {
            finish({ token: null, scopes: "", reason: "popup", expiresIn: 3600 });
            return;
          }
          if (type.includes("origin")) {
            finish({ token: null, scopes: "", reason: "origin", expiresIn: 3600 });
            return;
          }
          if (type.includes("popup") || type.includes("closed")) {
            finish({ token: null, scopes: "", reason: "cancel", expiresIn: 3600 });
            return;
          }
          finish({ token: null, scopes: "", reason: "error", expiresIn: 3600 });
        },
      });
      try {
        client.requestAccessToken({ prompt });
      } catch {
        finish({ token: null, scopes: "", reason: "popup", expiresIn: 3600 });
      }
    });
  }, []);

  const explainTokenFailure = useCallback((reason: GoogleTokenReason) => {
    if (reason === "cancel" || reason === "popup") return "已取消登入。若沒有看到 Google 視窗，請再按一次。";
    if (reason === "origin") return "登入網域尚未加入 Google Authorized Origins。";
    if (reason === "unconfigured") return "Google 登入尚未完成設定";
    return "登入沒有完成，請再試一次。";
  }, []);

  const signIn = useCallback(() => {
    const oauthClientId = getGoogleClientId();
    if (!oauthClientId) {
      setHint("Google 登入尚未完成設定");
      return;
    }
    if (!window.google?.accounts?.oauth2) {
      setHint("登入元件還在載入，請再按一次。");
      void loadGoogleIdentityScript().then(
        () => setSdkStatus("ready"),
        () => setSdkStatus("error"),
      );
      return;
    }
    setBusy(true);
    setHint(null);
    void openGoogleConsent(GOOGLE_LOGIN_SCOPES, "select_account")
      .then(async ({ token, reason, expiresIn }) => {
        if (!token) {
          setHint(explainTokenFailure(reason));
          return;
        }
        const profile = await fetchGoogleProfile(token, expiresIn);
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
  }, [applyAccount, explainTokenFailure, openGoogleConsent]);

  const connectYoutube = useCallback(() => {
    const oauthClientId = getGoogleClientId();
    if (!oauthClientId) {
      setHint("Google 登入尚未完成設定");
      return Promise.resolve(null);
    }
    if (!window.google?.accounts?.oauth2) {
      setHint("登入元件還在載入，請再按一次。");
      void loadGoogleIdentityScript();
      return Promise.resolve(null);
    }
    const existing = readYoutubeAccess();
    if (existing?.accessToken && accountRef.current) return Promise.resolve(existing.accessToken);
    const scope = accountRef.current
      ? YOUTUBE_SCOPES
      : `${GOOGLE_LOGIN_SCOPES} ${YOUTUBE_SCOPES}`;
    setBusy(true);
    setHint(null);
    return openGoogleConsent(scope, "consent").then(async ({ token, scopes, reason, expiresIn }) => {
      setBusy(false);
      if (!token) {
        setHint(
          reason === "cancel" || reason === "popup"
            ? "已取消 YouTube 授權。若沒有看到 Google 視窗，請再按一次。"
            : explainTokenFailure(reason),
        );
        return null;
      }
      if (!accountRef.current) {
        const profile = await fetchGoogleProfile(token, expiresIn);
        if (profile) applyAccount(profile);
      }
      if (!hasScope(scopes, YOUTUBE_READONLY_SCOPE)) {
        setHint("這個帳號尚未授權 YouTube 播放清單權限。");
        writeYoutubeAccess(null);
        return null;
      }
      setHint("已接上 YouTube，正在載入可播放的清單。");
      return token;
    });
  }, [applyAccount, explainTokenFailure, openGoogleConsent]);

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
    busy: busy || !configReady || sdkStatus === "loading",
    hint,
    configured,
    unavailable: (configReady && !configured) || sdkStatus === "error",
    sdkStatus,
    youtubeAccessToken: youtubeAccess?.accessToken ?? null,
    youtubeAuthorized: Boolean(youtubeAccess?.accessToken),
    signIn,
    signOut,
    connectYoutube,
    dismissHint: () => setHint(null),
  };
}
