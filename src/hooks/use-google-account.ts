"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { pullAndMergeCloudFavorites, pushCloudFavorites } from "@/lib/bookmark-sync";
import { getFavoritesSnapshot, subscribeFavorites } from "@/lib/favorites";
import {
  GOOGLE_ACCOUNT_EVENT,
  GOOGLE_CLIENT_ID,
  decodeIdToken,
  isAccountFresh,
  loadGoogleIdentityScript,
  readStoredAccount,
  writeStoredAccount,
  type GoogleAccount,
} from "@/lib/google-identity";

function subscribeAccount(onChange: () => void) {
  window.addEventListener(GOOGLE_ACCOUNT_EVENT, onChange);
  return () => window.removeEventListener(GOOGLE_ACCOUNT_EVENT, onChange);
}

export function useGoogleAccount() {
  const account = useSyncExternalStore(
    subscribeAccount,
    readStoredAccount,
    () => null,
  );
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const accountRef = useRef<GoogleAccount | null>(account);
  const signInHostRef = useRef<HTMLDivElement | null>(null);

  const renderSignInButton = useCallback((host: HTMLDivElement | null) => {
    if (!host || accountRef.current || !GOOGLE_CLIENT_ID) return;
    if (!window.google?.accounts?.id) return;
    host.innerHTML = "";
    window.google.accounts.id.renderButton(host, {
      type: "standard",
      theme: "filled_black",
      size: "medium",
      text: "signin_with",
      shape: "pill",
      locale: "zh_TW",
      width: 168,
    });
  }, []);

  const attachSignInHost = useCallback(
    (el: HTMLDivElement | null) => {
      signInHostRef.current = el;
      renderSignInButton(el);
    },
    [renderSignInButton],
  );

  useEffect(() => {
    accountRef.current = account;
  }, [account]);

  const applyAccount = useCallback((next: GoogleAccount | null) => {
    accountRef.current = next;
    writeStoredAccount(next);
  }, []);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;
    void loadGoogleIdentityScript()
      .then(() => {
        if (cancelled || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          auto_select: false,
          cancel_on_tap_outside: true,
          callback: (response) => {
            const next = decodeIdToken(response.credential);
            if (!next) {
              setHint("無法讀取 Google 帳號，請再試一次。");
              return;
            }
            applyAccount(next);
            setHint(null);
            void pullAndMergeCloudFavorites(next.idToken)
              .then(() => pushCloudFavorites(next.idToken, getFavoritesSnapshot()))
              .catch(() => {
                setHint("已登入，書籤先保存在此裝置。");
              });
          },
        });
        renderSignInButton(signInHostRef.current);
      })
      .catch(() => {
        if (!cancelled) setHint("無法載入 Google 登入。");
      });
    return () => {
      cancelled = true;
    };
  }, [applyAccount, renderSignInButton]);

  useEffect(() => {
    if (account) return;
    renderSignInButton(signInHostRef.current);
  }, [account, renderSignInButton]);

  useEffect(() => {
    if (!account) return;
    let timer = 0;
    const push = () => {
      const current = accountRef.current;
      if (!current || !isAccountFresh(current)) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void pushCloudFavorites(current.idToken, getFavoritesSnapshot()).catch(
          () => undefined,
        );
      }, 400);
    };
    push();
    return subscribeFavorites(push);
  }, [account]);

  const signIn = useCallback(() => {
    if (!GOOGLE_CLIENT_ID) {
      setHint("尚未設定 Google 登入，書籤仍保存在此裝置。");
      return;
    }
    setBusy(true);
    setHint(null);
    const prompt = () => {
      if (!window.google?.accounts?.id) {
        setBusy(false);
        setHint("Google 登入尚未就緒，請稍後再試。");
        return;
      }
      window.google.accounts.id.prompt((notification) => {
        setBusy(false);
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          setHint("請允許彈出視窗，或再點一次以登入 Google。");
        }
      });
    };
    void loadGoogleIdentityScript()
      .then(prompt)
      .catch(() => {
        setBusy(false);
        setHint("無法載入 Google 登入。");
      });
  }, []);

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
    applyAccount(null);
    setHint("已登出。書籤仍留在此裝置。");
  }, [applyAccount]);

  return {
    account,
    ready: true,
    busy,
    hint,
    configured: Boolean(GOOGLE_CLIENT_ID),
    signInHostRef: attachSignInHost,
    signIn,
    signOut,
    dismissHint: () => setHint(null),
  };
}
