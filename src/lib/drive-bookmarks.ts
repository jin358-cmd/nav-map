import { mergeFavorites, replaceFavorites, getFavoritesSnapshot } from "@/lib/favorites";
import type { GeocodeHit } from "@/types/domain";

const FILE_NAME = "navpilot-bookmarks.json";
const FILE_ID_KEY = "navpilot.drive-bookmarks-id.v1";

function isGeocodeHit(value: unknown): value is GeocodeHit {
  if (!value || typeof value !== "object") return false;
  const hit = value as Partial<GeocodeHit>;
  return Boolean(
    typeof hit.id === "string" &&
      typeof hit.name === "string" &&
      typeof hit.address === "string" &&
      hit.location &&
      Number.isFinite(hit.location.lng) &&
      Number.isFinite(hit.location.lat),
  );
}

async function driveGet<T>(path: string, token: string): Promise<T | null> {
  try {
    const response = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function readStoredFileId() {
  try {
    return window.sessionStorage.getItem(FILE_ID_KEY);
  } catch {
    return null;
  }
}

function writeStoredFileId(id: string | null) {
  try {
    if (!id) window.sessionStorage.removeItem(FILE_ID_KEY);
    else window.sessionStorage.setItem(FILE_ID_KEY, id);
  } catch {
    /* 私人模式 */
  }
}

async function findBookmarkFile(token: string) {
  const stored = readStoredFileId();
  if (stored) return stored;
  const listed = await driveGet<{ files?: { id?: string; name?: string }[] }>(
    `/files?spaces=appDataFolder&q=name='${FILE_NAME}'&fields=files(id,name)`,
    token,
  );
  const id = listed?.files?.[0]?.id ?? null;
  if (id) writeStoredFileId(id);
  return id;
}

export async function pullDriveFavorites(token: string) {
  const id = await findBookmarkFile(token);
  if (!id) return [];
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    if (!response.ok) return [];
    const payload = (await response.json()) as { favorites?: unknown };
    return Array.isArray(payload.favorites)
      ? payload.favorites.filter(isGeocodeHit)
      : [];
  } catch {
    return [];
  }
}

export async function pushDriveFavorites(token: string, favorites: GeocodeHit[]) {
  const body = JSON.stringify({ favorites });
  const existing = await findBookmarkFile(token);
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  try {
    if (existing) {
      const response = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${existing}?uploadType=media`,
        { method: "PATCH", headers, body },
      );
      return response.ok;
    }
    const metadata = {
      name: FILE_NAME,
      parents: ["appDataFolder"],
    };
    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" }),
    );
    form.append("file", new Blob([body], { type: "application/json" }));
    const response = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      },
    );
    if (!response.ok) return false;
    const created = (await response.json()) as { id?: string };
    if (created.id) writeStoredFileId(created.id);
    return true;
  } catch {
    return false;
  }
}

export async function syncDriveFavorites(token: string) {
  const cloud = await pullDriveFavorites(token);
  mergeFavorites(cloud);
  await pushDriveFavorites(token, getFavoritesSnapshot());
}

export async function replaceAndPushDriveFavorites(
  token: string,
  favorites: GeocodeHit[],
) {
  replaceFavorites(favorites);
  await pushDriveFavorites(token, favorites);
}
