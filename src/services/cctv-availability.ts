import {
  BLACK_SCREEN_CCTV_STORAGE_KEY,
  CCTV_BLACK_LUMINANCE_THRESHOLD,
  CCTV_VERIFY_POOL_SIZE,
  CCTV_VISIBLE_LIMIT,
} from "@/lib/cctv-constants";
import type { CctvCamera, CctvStatus } from "@/types/domain";

export const availabilityConfig = {
  storageKey: BLACK_SCREEN_CCTV_STORAGE_KEY,
  luminanceThreshold: CCTV_BLACK_LUMINANCE_THRESHOLD,
  verifyPoolSize: CCTV_VERIFY_POOL_SIZE,
  visibleLimit: CCTV_VISIBLE_LIMIT,
};

/**
 * Phase 2 reserves weather-style availability verification
 * (black-screen luminance, verify pool) without running image analysis.
 */
export async function verifyCameraAvailability(
  camera: CctvCamera,
): Promise<CctvStatus> {
  if (!camera.url) return "offline";
  if (camera.status === "unsupported") return "unsupported";
  return camera.status === "offline" ? "offline" : "unknown";
}

export function applyAvailability(
  camera: CctvCamera,
  status: CctvStatus,
): CctvCamera {
  return { ...camera, status };
}

export function isUnavailable(status: CctvStatus): boolean {
  return status === "offline" || status === "unsupported";
}
