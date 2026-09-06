import "server-only";

import { TAINAN_PARKING_SOURCE } from "@/lib/parking/constants";
import {
  readParkingMemory,
  writeParkingMemory,
} from "@/lib/parking/memory-store";
import { tainanParkingProvider } from "@/lib/parking/providers/tainan";
import {
  shouldSyncParking,
  upsertParkingSnapshot,
  writeParkingSyncLog,
} from "@/lib/parking/repository";
import type { ParkingSyncResult } from "@/lib/parking/schema";
import { isSupabaseConfigured } from "@/lib/supabase/server";

const providers = [tainanParkingProvider];

export async function syncParkingSource(
  source = TAINAN_PARKING_SOURCE,
  force = false,
): Promise<ParkingSyncResult> {
  const startedAt = new Date().toISOString();
  const provider = providers.find((item) => item.source === source);
  if (!provider) {
    return {
      source,
      startedAt,
      completedAt: new Date().toISOString(),
      fetchedRecords: 0,
      insertedRecords: 0,
      updatedRecords: 0,
      failedRecords: 0,
      supabaseWrites: 0,
      status: "failed",
      errorMessage: "未知的停車資料來源",
      lots: [],
    };
  }

  const need = shouldSyncParking(source);
  const cached = readParkingMemory(source);
  if (!force && cached && !need.lots && !need.availability) {
    return {
      source,
      startedAt,
      completedAt: new Date().toISOString(),
      fetchedRecords: cached.lots.length,
      insertedRecords: 0,
      updatedRecords: 0,
      failedRecords: 0,
      supabaseWrites: 0,
      status: "success",
      errorMessage: null,
      lots: cached.lots,
    };
  }

  const lots = await provider.fetchNormalized();
  if (!lots.length) {
    const result: ParkingSyncResult = {
      source,
      startedAt,
      completedAt: new Date().toISOString(),
      fetchedRecords: 0,
      insertedRecords: 0,
      updatedRecords: 0,
      failedRecords: 0,
      supabaseWrites: 0,
      status: "failed",
      errorMessage: "Open Data 沒有回傳停車場",
      lots: cached?.lots ?? [],
    };
    await writeParkingSyncLog(result);
    return result;
  }

  writeParkingMemory(source, lots, "both");
  let supabaseWrites = 0;
  let failedRecords = 0;
  if (isSupabaseConfigured()) {
    const written = await upsertParkingSnapshot(lots);
    supabaseWrites = written.written;
    failedRecords = written.failed;
  }

  const result: ParkingSyncResult = {
    source,
    startedAt,
    completedAt: new Date().toISOString(),
    fetchedRecords: lots.length,
    insertedRecords: cached ? 0 : lots.length,
    updatedRecords: cached ? lots.length : 0,
    failedRecords,
    supabaseWrites,
    status: failedRecords && supabaseWrites ? "partial" : "success",
    errorMessage: isSupabaseConfigured()
      ? failedRecords
        ? "部分列寫入 Supabase 失敗"
        : null
      : "Supabase 未設定，已用即時 Open Data 後備",
    lots,
  };
  await writeParkingSyncLog(result);
  return result;
}

export async function syncTainanParking(force = false) {
  return syncParkingSource(TAINAN_PARKING_SOURCE, force);
}
