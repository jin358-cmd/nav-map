"use client";

import { useEffect } from "react";
import {
  loadGoogleIdentityScript,
  resolveGoogleClientId,
} from "@/lib/google-identity";

export function GoogleAuthBootstrap() {
  useEffect(() => {
    void resolveGoogleClientId().then((clientId) => {
      if (clientId) void loadGoogleIdentityScript();
    });
  }, []);
  return null;
}
