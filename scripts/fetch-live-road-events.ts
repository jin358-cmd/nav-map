import { mkdirSync, writeFileSync } from "node:fs";
import { buildRoadEventCatalog } from "../src/lib/road-events/catalog";
import { taipeiToday } from "../src/lib/road-events/dates";
import { fetchOpenConstruction } from "../src/lib/road-events/fetch-open-data";
import { fetchTdxLiveSources, resetTdxFetchState, TDX_LIVE_SOURCES } from "../src/lib/road-events/tdx-http";

async function main() {
const today = taipeiToday();
const openReports = await fetchOpenConstruction({ today });
const clientId = process.env.TDX_CLIENT_ID?.trim() ?? "";
const clientSecret = process.env.TDX_CLIENT_SECRET?.trim() ?? "";
resetTdxFetchState();

let tdxNote: string | null = "未設定 TDX_CLIENT_ID / TDX_CLIENT_SECRET，沒有用會員金鑰打 TDX。";
let tdxReports: Awaited<ReturnType<typeof fetchTdxLiveSources>> = [];
if (clientId && clientSecret) {
  tdxReports = await fetchTdxLiveSources({
    credentials: { clientId, clientSecret },
    sources: TDX_LIVE_SOURCES,
    includeRaw: true,
  });
  mkdirSync("fixtures/tdx/live-events", { recursive: true });
  for (const report of tdxReports) {
    if (!report.rawPages.length) continue;
    const name = report.sourceDataset.replace(/[:/]/g, "-");
    writeFileSync(
      `fixtures/tdx/live-events/${name}.json`,
      JSON.stringify(
        report.rawPages.length === 1
          ? report.rawPages[0]
          : { pages: report.rawPages },
      ),
    );
  }
  tdxNote = null;
}

const catalog = buildRoadEventCatalog([...tdxReports, ...openReports]);
const summary = {
  taipeiDate: today,
  generatedAt: new Date().toISOString(),
  tdxCredentialed: Boolean(clientId && clientSecret),
  tdxNote: clientId && clientSecret ? null : tdxNote,
  tdxCalls: tdxReports.reduce((total, report) => total + report.calls, 0),
  dedupedCount: catalog.dedupedCount,
  eventCount: catalog.events.length,
  tdx: tdxReports.map((report) => ({
    source: report.sourceDataset,
    ok: report.ok,
    error: report.error,
    httpStatus: report.httpStatus,
    calls: report.calls,
    updateTime: report.updateTime,
    rawCount: report.rawCount,
    uniqueCount: report.uniqueCount,
    byEventType: report.byEventType,
    withCoordinates: report.withCoordinates,
  })),
  openData: openReports.map((report) => ({
    city: report.city,
    datasetId: report.datasetId,
    datasetUrl: report.datasetUrl,
    format: report.format,
    coordinateSystem: report.coordinateSystem,
    frequency: report.frequency,
    ok: report.ok,
    error: report.error,
    httpStatus: report.httpStatus,
    updateTime: report.updateTime,
    rawCount: report.rawCount,
    uniqueCount: report.uniqueCount,
    activeCount: report.activeCount,
    withCoordinates: report.withCoordinates,
    note: report.note,
  })),
};

mkdirSync("fixtures/road-events", { recursive: true });
writeFileSync("fixtures/road-events/fetch-summary.json", JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
}

main();
