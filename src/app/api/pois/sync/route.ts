import { isSupabaseConfigured } from "@/lib/supabase/server";
import { poiIndexStats } from "@/lib/poi/server-index";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const key = process.env.POI_SYNC_KEY?.trim();
  const provided = request.headers.get("x-poi-sync-key")?.trim();
  if (key && provided !== key) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json({
    ok: true,
    status: "queued-local-index",
    hint: "Run npm run ingest:pois on the server to refresh OSM Overpass + Photon index.",
    supabaseConfigured: isSupabaseConfigured(),
    index: poiIndexStats(),
    fields: [
      "source",
      "source_id",
      "name",
      "normalized_name",
      "aliases",
      "brand",
      "branch_name",
      "category",
      "address",
      "normalized_address",
      "city",
      "district",
      "lat",
      "lng",
      "updated_at",
      "confidence",
      "is_active",
    ],
  });
}

export async function GET() {
  return Response.json({
    index: poiIndexStats(),
    supabaseConfigured: isSupabaseConfigured(),
  });
}
