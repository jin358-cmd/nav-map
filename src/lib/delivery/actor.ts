import "server-only";

import { readGoogleOAuthClientId } from "@/lib/google-oauth-env";

const ACTOR_ID = /^[A-Za-z0-9_-]{8,128}$/;

export type DeliveryActor = {
  role: "customer" | "courier";
  id: string;
  auth: "google" | "device";
};

type TokenInfo = {
  sub?: string;
  aud?: string;
  azp?: string;
  exp?: string;
};

function invalid(message: string, status = 400) {
  return Response.json({ ok: false, error: "invalid", message }, { status });
}

async function googleSubject(token: string) {
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`,
    { cache: "no-store" },
  );
  if (!response.ok) return null;
  const info = (await response.json()) as TokenInfo;
  if (!info.sub) return null;
  const expected = readGoogleOAuthClientId();
  const audience = info.aud || info.azp || "";
  if (expected && audience && audience !== expected) return null;
  const exp = Number(info.exp);
  if (Number.isFinite(exp) && exp * 1000 < Date.now()) return null;
  return info.sub;
}

export async function readDeliveryActor(
  request: Request,
  expected: DeliveryActor["role"],
): Promise<{ ok: true; actor: DeliveryActor } | { ok: false; response: Response }> {
  const role = request.headers.get("x-delivery-role");
  if (role !== "customer" && role !== "courier") {
    return { ok: false, response: invalid("缺少外送身份。") };
  }
  if (role !== expected) {
    return { ok: false, response: invalid(expected === "customer" ? "這是顧客用的操作。" : "這是外送員用的操作。") };
  }
  const header = request.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (role === "customer" && bearer) {
    try {
      const sub = await googleSubject(bearer);
      if (!sub || !ACTOR_ID.test(sub)) {
        return {
          ok: false,
          response: Response.json(
            { ok: false, error: "forbidden", message: "Google 登入狀態無效。" },
            { status: 401 },
          ),
        };
      }
      return { ok: true, actor: { role, id: sub, auth: "google" } };
    } catch {
      return {
        ok: false,
        response: Response.json(
          { ok: false, error: "unavailable", message: "暫時無法確認 Google 登入。" },
          { status: 503 },
        ),
      };
    }
  }
  const actorId = request.headers.get("x-delivery-actor")?.trim() ?? "";
  if (!ACTOR_ID.test(actorId)) {
    return { ok: false, response: invalid("身份代號無效。") };
  }
  return { ok: true, actor: { role, id: actorId, auth: "device" } };
}
