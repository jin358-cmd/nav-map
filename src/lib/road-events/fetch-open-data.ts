import { taipeiToday } from "./dates";
import {
  normalizeChiayiXml,
  normalizeNewTaipeiDaily,
  normalizeNewTaipeiLive,
  normalizeTaichung,
  normalizeTaipeiToday,
  normalizeTaipeiTomorrow,
  parseCsv,
} from "./normalize-open-data";
import { geometryFromPositions, geometryUsable } from "./geometry";
import type { SourceNormalizeResult } from "./types";

export type OpenConstructionReport = SourceNormalizeResult & {
  city: string;
  datasetId: string | null;
  datasetUrl: string | null;
  format: string;
  coordinateSystem: string;
  frequency: string;
  httpStatus: number | null;
  note: string | null;
};

type FetchImpl = typeof fetch;

const SOURCES: Array<{
  id: string;
  city: string;
  datasetId: string | null;
  datasetUrl: string | null;
  downloadUrl: string | null;
  format: string;
  coordinateSystem: string;
  frequency: string;
  note: string | null;
  parse?: (body: string, today: string, updateTime: string | null) => SourceNormalizeResult;
}> = [
  {
    id: "open:taipei-today",
    city: "臺北市",
    datasetId: "145614",
    datasetUrl: "https://data.gov.tw/dataset/145614",
    downloadUrl: "https://tpnco.blob.core.windows.net/blobfs/Todaywork.json",
    format: "GeoJSON",
    coordinateSystem: "TWD97 TM2 121（EPSG:3826）",
    frequency: "每 10 分",
    note: null,
    parse: (body, today, updateTime) =>
      normalizeTaipeiToday(JSON.parse(body.replace(/^\uFEFF/, "")), { today, updateTime }),
  },
  {
    id: "open:taipei-tomorrow",
    city: "臺北市",
    datasetId: "145612",
    datasetUrl: "https://data.gov.tw/dataset/145612",
    downloadUrl: "https://tpnco.blob.core.windows.net/blobfs/Reserve.json",
    format: "GeoJSON",
    coordinateSystem: "TWD97 TM2 121（EPSG:3826）",
    frequency: "每日",
    note: "明日預約，不算當日已開工。",
    parse: (body, today, updateTime) =>
      normalizeTaipeiTomorrow(JSON.parse(body.replace(/^\uFEFF/, "")), { today, updateTime }),
  },
  {
    id: "open:newtaipei-live",
    city: "新北市",
    datasetId: "177913",
    datasetUrl: "https://data.gov.tw/dataset/177913",
    downloadUrl: "https://data.ntpc.gov.tw/api/datasets/e4014a7a-e41b-4430-859e-092a97608327/csv/file",
    format: "CSV",
    coordinateSystem: "TWD97 TM2 121（EPSG:3826），含多邊形",
    frequency: "每 10 分",
    note: null,
    parse: (body, today, updateTime) => normalizeNewTaipeiLive(body, { today, updateTime }),
  },
  {
    id: "open:newtaipei-daily",
    city: "新北市",
    datasetId: "122989",
    datasetUrl: "https://data.gov.tw/dataset/122989",
    downloadUrl: "https://data.ntpc.gov.tw/api/datasets/96b6101b-c033-4834-8bd5-e312651db7a0/csv/file",
    format: "CSV",
    coordinateSystem: "TWD97 TM2 121（EPSG:3826）",
    frequency: "每日",
    note: "狀態只有已核發許可證，沒有開工打卡，不計入施工中。",
    parse: (body, _today, updateTime) => normalizeNewTaipeiDaily(body, { updateTime }),
  },
  {
    id: "open:taichung",
    city: "臺中市",
    datasetId: "105203",
    datasetUrl: "https://data.gov.tw/dataset/105203",
    downloadUrl:
      "https://newdatacenter.taichung.gov.tw/api/v1/no-auth/resource.download?rid=d5adb71a-00bb-4573-b67e-ffdccfc7cd27",
    format: "JSON",
    coordinateSystem: "WGS84 點與 POLYGON",
    frequency: "每 10 分",
    note: "只保留是否開工=是且核准期間涵蓋今天的案件。",
    parse: (body, today, updateTime) =>
      normalizeTaichung(JSON.parse(body.replace(/^\uFEFF/, "")), { today, updateTime }),
  },
  {
    id: "open:pingtung",
    city: "屏東縣",
    datasetId: "177357",
    datasetUrl: "https://data.gov.tw/dataset/177357",
    downloadUrl: "https://e-road.pthg.gov.tw/openDataService.aspx",
    format: "CSV（網站標成 XML）",
    coordinateSystem: "TWD97",
    frequency: "每日",
    note: null,
    parse: (body, _today, updateTime) => inspectLoose("open:pingtung", body, updateTime),
  },
  {
    id: "open:kaohsiung",
    city: "高雄市",
    datasetId: "127967",
    datasetUrl: "https://data.gov.tw/dataset/127967",
    downloadUrl: "https://openapi.kcg.gov.tw/Api/Service/Get/d636aa85-4b08-42ab-a742-4f2aad070450",
    format: "JSON",
    coordinateSystem: "WGS84",
    frequency: "不定期",
    note: null,
    parse: (body, _today, updateTime) => inspectLoose("open:kaohsiung", body, updateTime),
  },
  {
    id: "open:taoyuan",
    city: "桃園市",
    datasetId: "25880",
    datasetUrl: "https://data.gov.tw/dataset/25880",
    downloadUrl:
      "https://opendata.tycg.gov.tw/api/dataset/56c616fe-07d7-4b0c-bb75-e8f8cd75500a/resource/52de3762-1490-4a86-a074-0062d746873b/download",
    format: "XML",
    coordinateSystem: "未提供（本次回應為空陣列）",
    frequency: "不定期",
    note: null,
    parse: (body) => {
      const trimmed = body.trim();
      const result = emptyLike("open:taoyuan");
      if (trimmed === "[]" || trimmed === "") return result;
      result.rawCount = trimmed.startsWith("<")
        ? (trimmed.match(/<CaseID\b/gi) ?? []).length
        : 0;
      return result;
    },
  },
  {
    id: "open:chiayi",
    city: "嘉義市",
    datasetId: "101558",
    datasetUrl: "https://data.gov.tw/dataset/101558",
    downloadUrl:
      "https://data.chiayi.gov.tw/opendata/api/getResource?oid=2cf1aa4f-3cdd-46a0-be84-b6f161cd892d&rid=ca4c025d-1856-4200-81b7-a401aa653da3",
    format: "XML / GML",
    coordinateSystem: "GML 標成 EPSG:3822，座標實為 TWD97 TM2 121",
    frequency: "每日",
    note: "核准期間涵蓋今天且沒有結案日才算施工中。",
    parse: (body, today, updateTime) => normalizeChiayiXml(body, { today, updateTime }),
  },
  {
    id: "open:tainan",
    city: "臺南市",
    datasetId: "6176",
    datasetUrl: "https://data.gov.tw/dataset/6176",
    downloadUrl: null,
    format: "JSON/CSV 年度彙整",
    coordinateSystem: "不適用",
    frequency: "不定期歷史檔",
    note: "6176 資源只到 202306 的年度統計；146234 今日施工已下架。即時施工改看 TDX。",
  },
];

function inspectLoose(id: string, body: string, updateTime: string | null): SourceNormalizeResult {
  const result = emptyLike(id);
  result.updateTime = updateTime;
  const trimmed = body.trim();
  if (!trimmed || trimmed === "[]" || trimmed === "{}") return result;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const rows = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object"
        ? Object.values(parsed).find((value) => Array.isArray(value))
        : null;
    result.rawCount = Array.isArray(rows) ? rows.length : 0;
    result.uniqueCount = result.rawCount;
    return result;
  } catch {
    const lines = trimmed.split(/\r?\n/).filter((line) => line.trim());
    result.rawCount = Math.max(0, lines.length - (lines[0]?.includes(",") ? 1 : 0));
    result.uniqueCount = result.rawCount;
    return result;
  }
}

function emptyLike(id: string): SourceNormalizeResult {
  return {
    sourceDataset: id,
    ok: true,
    error: null,
    updateTime: null,
    rawCount: 0,
    uniqueCount: 0,
    byEventType: {},
    withCoordinates: 0,
    activeCount: 0,
    events: [],
  };
}

function headerTime(response: Response) {
  return response.headers.get("last-modified") ?? response.headers.get("date");
}

export async function fetchOpenConstruction(options?: {
  today?: string;
  fetchImpl?: FetchImpl;
  timeoutMs?: number;
}): Promise<OpenConstructionReport[]> {
  const today = options?.today ?? taipeiToday();
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 40_000;
  const reports: OpenConstructionReport[] = [];

  await Promise.all(
    SOURCES.map(async (source) => {
      const base = {
        city: source.city,
        datasetId: source.datasetId,
        datasetUrl: source.datasetUrl,
        format: source.format,
        coordinateSystem: source.coordinateSystem,
        frequency: source.frequency,
        note: source.note,
      };
      if (!source.downloadUrl || !source.parse) {
        reports.push({
          ...emptyLike(source.id),
          ok: false,
          error: source.note,
          ...base,
          httpStatus: null,
        });
        return;
      }
      try {
        const response = await fetchImpl(source.downloadUrl, {
          headers: { Accept: "*/*", "User-Agent": "navpilot-road-events" },
          cache: "no-store",
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok) {
          reports.push({
            ...emptyLike(source.id),
            ok: false,
            error: `HTTP ${response.status}`,
            ...base,
            httpStatus: response.status,
          });
          return;
        }
        const body = await response.text();
        const normalized = source.parse(body, today, headerTime(response));
        if (source.id === "open:taipei-tomorrow") {
          normalized.withCoordinates = countTaipeiGeometries(body);
        }
        if (source.id === "open:newtaipei-daily") {
          normalized.withCoordinates = countDailyPoints(body);
        }
        reports.push({
          ...normalized,
          ...base,
          note: source.note,
          httpStatus: response.status,
        });
      } catch (error) {
        const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
        const cause = error instanceof Error ? (error.cause as { code?: string } | undefined) : undefined;
        const detail = error instanceof Error ? error.message : "fetch failed";
        reports.push({
          ...emptyLike(source.id),
          ok: false,
          error: timedOut ? "timeout" : cause?.code ? `${detail} (${cause.code})` : detail,
          ...base,
          httpStatus: null,
        });
      }
    }),
  );

  return SOURCES.map((source) => reports.find((report) => report.sourceDataset === source.id)).filter(
    (report): report is OpenConstructionReport => Boolean(report),
  );
}

function countTaipeiGeometries(body: string) {
  try {
    const payload = JSON.parse(body.replace(/^\uFEFF/, "")) as {
      features?: { geometry?: { type?: string; coordinates?: unknown } }[];
    };
    return (payload.features ?? []).filter((feature) => {
      const geometry = geometryFromPositions(
        feature.geometry?.coordinates,
        feature.geometry?.type ?? null,
        121,
      );
      return geometryUsable(geometry);
    }).length;
  } catch {
    return 0;
  }
}

function countDailyPoints(body: string) {
  return parseCsv(body).filter((row) => {
    const geometry = geometryFromPositions(
      [Number(row.twd97x), Number(row.twd97y)],
      "Point",
      121,
    );
    return geometryUsable(geometry);
  }).length;
}

export function openConstructionEvents(reports: OpenConstructionReport[]) {
  return reports.flatMap((report) => report.events);
}
