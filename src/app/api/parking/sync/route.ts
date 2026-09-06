import { TAINAN_PARKING_SOURCE } from "@/lib/parking/constants";
import { syncParkingSource } from "@/lib/parking/sync";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const required = process.env.PARKING_SYNC_KEY?.trim();
  if (required) {
    const provided =
      request.headers.get("x-parking-sync-key")?.trim() ||
      new URL(request.url).searchParams.get("key")?.trim() ||
      "";
    if (provided !== required) {
      return Response.json({ error: "未授權" }, { status: 401 });
    }
  }

  const body = (await request.json().catch(() => ({}))) as { source?: string; force?: boolean };
  const result = await syncParkingSource(body.source || TAINAN_PARKING_SOURCE, body.force !== false);
  return Response.json({
    source: result.source,
    fetchedRecords: result.fetchedRecords,
    insertedRecords: result.insertedRecords,
    updatedRecords: result.updatedRecords,
    failedRecords: result.failedRecords,
    supabaseWrites: result.supabaseWrites,
    supabaseConfigured: isSupabaseConfigured(),
    status: result.status,
    errorMessage: result.errorMessage,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
  });
}
