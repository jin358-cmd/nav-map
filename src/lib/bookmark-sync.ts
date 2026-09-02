import { mergeFavorites } from "@/lib/favorites";
import type { GeocodeHit } from "@/types/domain";

export async function fetchCloudFavorites(idToken: string) {
  const response = await fetch("/api/bookmarks", {
    headers: { Authorization: `Bearer ${idToken}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { favorites?: GeocodeHit[] };
  return Array.isArray(payload.favorites) ? payload.favorites : [];
}

export async function pushCloudFavorites(
  idToken: string,
  favorites: GeocodeHit[],
) {
  const response = await fetch("/api/bookmarks", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ favorites }),
  });
  return response.ok;
}

export async function pullAndMergeCloudFavorites(idToken: string) {
  const cloud = await fetchCloudFavorites(idToken);
  if (!cloud) return;
  mergeFavorites(cloud);
}
