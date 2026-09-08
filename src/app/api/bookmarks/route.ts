import { readCloudFavorites, sanitizeFavorites, writeCloudFavorites } from "@/lib/cloud-bookmarks";
import { readGoogleOAuthClientId } from "@/lib/google-oauth-env";

export const dynamic = "force-dynamic";

type TokenInfo = {
  sub?: string;
  aud?: string;
  azp?: string;
  exp?: string;
  email?: string;
};

function isJwt(token: string) {
  return token.split(".").length === 3;
}

async function tokenInfo(token: string, kind: "access_token" | "id_token") {
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?${kind}=${encodeURIComponent(token)}`,
    { cache: "no-store" },
  );
  if (!response.ok) return null;
  return (await response.json()) as TokenInfo;
}

async function verifyGoogleToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;

  const expectedAud = readGoogleOAuthClientId();

  try {
    const info = isJwt(token)
      ? (await tokenInfo(token, "id_token")) ?? (await tokenInfo(token, "access_token"))
      : (await tokenInfo(token, "access_token")) ?? (await tokenInfo(token, "id_token"));
    if (!info?.sub) return null;
    const audience = info.aud || info.azp || "";
    if (expectedAud && audience && audience !== expectedAud) return null;
    const exp = Number(info.exp);
    if (Number.isFinite(exp) && exp * 1000 < Date.now()) return null;
    return info.sub;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const sub = await verifyGoogleToken(request);
  if (!sub) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const favorites = await readCloudFavorites(sub);
  return Response.json({ favorites });
}

export async function PUT(request: Request) {
  const sub = await verifyGoogleToken(request);
  if (!sub) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  const favorites = sanitizeFavorites(
    body && typeof body === "object" && "favorites" in body
      ? (body as { favorites: unknown }).favorites
      : body,
  );
  await writeCloudFavorites(sub, favorites);
  return Response.json({ favorites });
}
