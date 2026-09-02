import { readCloudFavorites, sanitizeFavorites, writeCloudFavorites } from "@/lib/cloud-bookmarks";

export const dynamic = "force-dynamic";

type TokenInfo = {
  sub?: string;
  aud?: string;
  exp?: string;
  email?: string;
};

async function verifyGoogleToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;

  const expectedAud =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
    process.env.GOOGLE_CLIENT_ID?.trim() ||
    "";

  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`,
      { cache: "no-store" },
    );
    if (!response.ok) return null;
    const info = (await response.json()) as TokenInfo;
    if (!info.sub) return null;
    if (expectedAud && info.aud && info.aud !== expectedAud) return null;
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
