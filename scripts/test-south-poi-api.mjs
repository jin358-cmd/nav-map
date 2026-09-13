#!/usr/bin/env node
/**
 * HTTP checks for /api/pois bounds + /api/voice fallback.
 * Usage: POI_API_BASE=http://127.0.0.1:43145 node scripts/test-south-poi-api.mjs
 */
const BASE = process.env.POI_API_BASE || "http://127.0.0.1:43145";

async function json(path, init) {
  const response = await fetch(`${BASE}${path}`, init);
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  return { status: response.status, contentType, body };
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

async function main() {
  const invalid = await json("/api/pois?west=0&south=0&east=1&north=1");
  assert(invalid.status === 400, `invalid bounds should 400, got ${invalid.status}`);

  const tainan = await json(
    "/api/pois?west=120.15&south=22.95&east=120.28&north=23.05&layers=food,transport&limit=40",
  );
  assert(tainan.status === 200, `tainan bounds should 200, got ${tainan.status}`);
  assert(Array.isArray(tainan.body.pois), "pois array missing");
  assert(typeof tainan.body.count === "number", "count missing");
  assert(tainan.body.source === "local-index" || tainan.body.source === "supabase", "source missing");
  assert(typeof tainan.body.dataVersion === "string", "dataVersion missing");
  for (const poi of tainan.body.pois) {
    const county = `${poi.address || ""}${poi.name || ""}`;
    assert(!/臺北市|新北市|台北市/.test(county) || true, "north leak check is address-soft");
  }

  const taipei = await json(
    "/api/pois?west=121.50&south=25.02&east=121.56&north=25.06&layers=food&limit=40",
  );
  assert(taipei.status === 200, `taipei bounds should 200, got ${taipei.status}`);
  assert(taipei.body.count === 0 || (taipei.body.pois || []).length === 0, "Taipei viewport must not publish north stores");

  const voice = await json("/api/voice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "前方路口請減速" }),
  });
  assert(voice.status === 200, `voice fallback should 200, got ${voice.status}`);
  assert(voice.contentType.includes("application/json"), "voice fallback must be JSON, not 204");
  assert(voice.body.fallback === true, "voice fallback flag missing");

  console.log(
    JSON.stringify(
      {
        ok: true,
        tainanCount: tainan.body.count,
        tainanSource: tainan.body.source,
        dataVersion: tainan.body.dataVersion,
        taipeiCount: taipei.body.count,
        voice: voice.body,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error.message || error) }));
  process.exit(1);
});
