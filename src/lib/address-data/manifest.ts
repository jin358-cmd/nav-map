import type { AddressSourceManifest } from "@/lib/address-data/schema";
import { TAIWAN_COUNTIES } from "@/lib/address-data/schema";

const CHECKED_AT = "2026-09-13";
const SOUTH = new Set(["雲林縣", "嘉義市", "嘉義縣", "臺南市", "高雄市", "屏東縣"]);

function countyDoorplate(county: string): AddressSourceManifest {
  const southDerived = SOUTH.has(county);
  return {
    county,
    datasetName: `${county}門牌公開資料`,
    sourceUrl: southDerived ? "local://src/data/south-address-index.json.gz" : "NOT CONFIGURED",
    license: southDerived
      ? "OGDL + NLSC 衍生 staging，不是該縣市合法門牌原始檔"
      : "各縣市政府開放資料授權，匯入前須核對條款",
    coordinateSystem: "EPSG:4326",
    lastCheckedAt: CHECKED_AT,
    enabled: southDerived,
    status: southDerived ? "nlsc_derived" : "not_configured",
    notes: southDerived
      ? "本機 NLSC 衍生門牌 staging。ADDRESS_DOORPLATES_DIR 有官方檔時才改標 official-county-file。"
      : "不得在未核准前寫死下載網址或偽造門牌座標。",
  };
}

export const ADDRESS_SOURCE_MANIFEST: AddressSourceManifest[] = [
  {
    county: "全國",
    datasetName: "內政部全國路名資料",
    sourceUrl: "NOT CONFIGURED",
    license: "政府資料開放授權條款，實際條款以資料集頁面為準",
    coordinateSystem: "EPSG:4326",
    lastCheckedAt: CHECKED_AT,
    enabled: false,
    status: "not_configured",
    notes: "僅接受官方公開下載。匯入腳本支援 dry-run，正式網址尚未核准。",
  },
  {
    county: "全國",
    datasetName: "TGOS 地址定位",
    sourceUrl: "https://api.tgos.tw/",
    license: "內政部國土測繪中心 TGOS 使用條款",
    coordinateSystem: "EPSG:4326",
    lastCheckedAt: CHECKED_AT,
    enabled: true,
    status: "enabled",
    notes: "執行期搜尋。APPID／APIKEY 僅限 server。",
  },
  {
    county: "全國",
    datasetName: "NLSC 門牌／地標模糊檢索",
    sourceUrl: "https://api.nlsc.gov.tw/",
    license: "國土測繪中心服務條款",
    coordinateSystem: "EPSG:4326",
    lastCheckedAt: CHECKED_AT,
    enabled: true,
    status: "enabled",
    notes: "執行期搜尋與反查。",
  },
  {
    county: "全國",
    datasetName: "OpenStreetMap／Nominatim",
    sourceUrl: "https://nominatim.openstreetmap.org/",
    license: "ODbL",
    coordinateSystem: "EPSG:4326",
    lastCheckedAt: CHECKED_AT,
    enabled: true,
    status: "enabled",
    notes: "僅在使用者明確送出搜尋後呼叫，不作逐字 autocomplete。",
  },
  {
    county: "全國",
    datasetName: "Overture Maps Places／Buildings",
    sourceUrl: "https://docs.overturemaps.org/",
    license: "CDLA Permissive 2.0（Places 等以官方 release 為準）",
    coordinateSystem: "EPSG:4326",
    lastCheckedAt: CHECKED_AT,
    enabled: false,
    status: "dataset_not_imported",
    notes: "只可後端 ETL。不得當官方精確門牌，也不得打包進前端。",
  },
  {
    county: "全國",
    datasetName: "Supabase 已確認地址索引",
    sourceUrl: "NOT CONFIGURED",
    license: "自有快取，來源授權隨原始紀錄",
    coordinateSystem: "EPSG:4326",
    lastCheckedAt: CHECKED_AT,
    enabled: false,
    status: "not_configured",
    notes: "未確認 NavPilot 專案前不寫庫。本機改走 south-address-index.json.gz。",
  },
  ...TAIWAN_COUNTIES.map((county) => countyDoorplate(county)),
];
