# 智路臺灣 Smart Road Taiwan

台灣智慧駕駛地圖＋即時道路情報平台。產品定位是 **駕駛視角的道路情報**，不是 Google Maps 克隆。

第一階段 Prototype 以 **臺南市區** 為示範範圍（中正路北上，民生路口右轉往臺南火車站）。Phase 2 已把 weather 專案的 CCTV 篩選／距離／city+freeway 模型移植到 MapLibre Driving HUD；交通與災害仍是 mock。尚未串接真實 TDX live。

## 技術架構

| 層 | 技術 |
| --- | --- |
| 框架 | Next.js 16 App Router、TypeScript |
| UI | Tailwind CSS 4、shadcn/ui |
| 地圖 | MapLibre GL JS 6、OpenFreeMap 向量圖磚 |
| 部署 | Vercel（Next.js 原生） |

資料流維持分離：

`components`（UI）→ `services`（資料存取）→ `data`（Phase 1 mock）或未來的 TDX／防災 API。

```
src/
  app/                      App Router、MapLibre worker 路由
  components/
    driving/                全螢幕駕駛 HUD 組合
    map/                    MapLibre、Vehicle Marker、控制鈕
    overlay/                導航列、道路情報卡、CCTV 卡
    ui/                     shadcn 元件
  data/                     mock 交通／災害、CCTV snapshot（cctv-fallback.json）
  hooks/                    useCctvView（距離、viewport、節流）
  services/
    cctv.ts                 TDX → snapshot → mock
    tdx.ts                  預留 MOTC TDX live
    disaster-api.ts         預留防災 API（Phase 4）
    geolocation.ts          瀏覽器 GPS
  lib/                      地圖樣式、CCTV 圖層／評分、常數
  types/                    領域型別
```

Dark Driving Mode：石墨黑底、灰藍道路、青綠路線；CCTV 紫、事故紅、壅塞橘紅、災害琥珀橘。

## 安裝方式

需要 Node.js 20 以上。

```bash
git clone <repo-url>
cd taiwan-pilot
npm install
```

複製環境變數範本（目前可保持空白）：

```bash
cp .env.example .env.local
```

## 本機啟動方式

```bash
npm run dev
```

瀏覽器開啟 [http://127.0.0.1:43145](http://127.0.0.1:43145)。

```bash
npm run lint
npm run build
npm start
```

定位權限可拒絕；拒絕後仍停留在臺南示範路線。GPS 授權成功則車輛標記移到目前位置。

頂部可輸入地址或地標（OpenStreetMap Nominatim）。選定後用 OSRM 規劃開車路線，青綠線會畫在地圖上，並帶終點標記。失敗時仍可點快捷地標（臺南火車站、安平古堡等）。

## 第一階段已完成功能

- 全螢幕 MapLibre 地圖，預設中心在臺南
- Dark Driving Mode（石墨黑、灰藍道路、青綠路線）
- 駕駛視角 3D：pitch 約 60°，車子在可見駕駛區下方約 30%，前方視野拉長
- 2D / 3D 切換、GPS 定位、居中、回臺南示範
- 自訂 Vehicle Marker（不是 Google 藍點）
- CCTV：獨立 `cctv-source` / `cctv-layer`，依 1 km／8 km／zoom 顯示，點擊底部 HUD
- Mock Traffic 圖層、Mock Disaster / 事故標記
- 頂部地址搜尋：規劃開車路線並在地圖顯示青綠路徑
- 頂部導航資訊 UI（八百公尺後右轉／前往目的地）
- 底部半透明 Road Information Card
- Android 直式優先的 Responsive HUD（資訊卡不遮住主要駕駛視野）

目前 **不要** 填入真實 TDX 金鑰。未設定時 CCTV 走本地 SNAPSHOT（來自 weather 的 city／freeway JSON），再不行才用 8 支 MOCK。

Phase 2 對照報告：[`docs/PHASE-2-CCTV.md`](docs/PHASE-2-CCTV.md)。

## Future Roadmap

**Phase 2：CCTV 顯示（本階段）**  
已完成 weather 邏輯移植與 Driving HUD。TDX live token 仍是 stub，下一步才是真實認證與影像 URL。

**Phase 3：即時交通**  
TDX Live Traffic 取代 mock 壅塞線，依真實車速上色。

**Phase 4：災害資訊**  
NCDR 或地方防災 API 取代 mock 積水／封路／強風標記。

**Phase 5：路線規劃（部分完成）**  
已可用地址／地標規劃開車路徑。進階避開壅塞與多點停靠尚未做。

**Phase 6：Turn-by-turn Navigation**  
依 GPS heading 對齊車頭、逐步轉向指示與語音。

**Phase 7：PWA / Driving Assistant**  
可安裝、離線底圖快取、車機／直式駕駛助理佈局。

## Vercel 部署

本專案是標準 Next.js App Router，可直接部署 Vercel：

- Framework Preset：Next.js
- Build Command：`npm run build`
- Output：Next.js 預設
- 環境變數：可先不設 `NEXT_PUBLIC_TDX_*`

MapLibre worker 由 `src/app/maplibre/[file]/route.ts` 提供，`next.config.ts` 已列入 tracing，避免 serverless 漏檔。

## 授權

Prototype 僅供展示。OpenStreetMap／OpenFreeMap 圖資依其授權標示。TDX 正式使用需申請 MOTC 帳號並遵守其條款。
