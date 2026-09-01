import { TAINAN_DISASTERS } from "@/data/mock-disasters";
import { TAINAN_ACCIDENTS } from "@/data/mock-route";
import type { AccidentReport, DisasterAlert } from "@/types/domain";

/**
 * Disaster / incident service layer.
 * Phase 1: mock Tainan alerts.
 * Later: NCDR, 地方防災, or 警廣路況 feeds.
 */
export async function fetchDisasterAlerts(): Promise<DisasterAlert[]> {
  return TAINAN_DISASTERS;
}

export async function fetchAccidentReports(): Promise<AccidentReport[]> {
  return TAINAN_ACCIDENTS;
}
