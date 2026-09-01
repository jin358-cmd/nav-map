# 智路臺灣 Smart Road Taiwan

台灣智慧駕駛地圖＋即時道路情報平台的第一階段 Prototype。這不是 Google Maps 克隆：畫面以駕駛視角為主，強調前方路況、CCTV、壅塞與災害情報。

目前示範範圍：**臺南市區**（中正路北上、民生路口右轉往臺南火車站）。

## 功能（Phase 1）

- 全螢幕 MapLibre 地圖，預設中心在臺南
- GPS 定位成功後，自訂車輛標記移到目前位置（不是 Google 藍點）
- 駕駛視角：pitch 約 60°，車子約在畫面下方 30%，前方視野拉長
- Dark Driving Mode：石墨黑底、灰藍道路、青綠路線高亮
- 臺南 mock CCTV：點擊紫色鏡頭標記，底部資訊卡顯示路口、狀態、查看即時影像
- mock 交通圖層與災害／事故標記，顏色可清楚區分
- 頂部導航提示（八百公尺後右轉）
- 底部半透明 Road Information Card
- 地圖控制：定位、2D/3D、居中、回臺南示範

## 技術棧

- Next.js 16（App Router）
- TypeScript
- Tailwind CSS 4 + shadcn/ui
- MapLibre GL JS
- OpenFreeMap vector tiles（無 API key）

## 快速開始

```bash
npm install
npm run dev
```

瀏覽器開啟 [http://127.0.0.1:43145](http://127.0.0.1:43145)。

```bash
npm run lint
npm run build
npm start
```

定位權限可拒絕；拒絕後仍停留在臺南示範路線。未來串接 TDX 時，複製 `.env.example` 為 `.env.local` 並填入 Client ID／Secret。未設定時一律使用 mock 資料。

## 架構

```
src/
  app/                  App Router 入口
  components/
    driving/            畫面組合（地圖 + HUD）
    map/                MapLibre、車輛標記、控制鈕
    overlay/            導航列、道路情報卡、CCTV 卡
    ui/                 shadcn 元件
  data/                 Phase 1 mock 資料
  services/             資料存取層（UI 不直接讀 mock）
    tdx.ts              預留給 MOTC TDX CCTV／路況
    disaster-api.ts     預留給防災／事故來源
    geolocation.ts      瀏覽器 GPS
  lib/                  地圖樣式、圖層、常數
  types/                領域型別
```

資料流：`components` → `services` → `data`（mock）或未來的 TDX／防災 API。地圖視覺在 `lib/map-style.ts` 於 style load 後上色，情報圖層在 `lib/map-layers.ts` 以 GeoJSON 套上。

## 地圖視覺

| 元素 | 顏色 |
| --- | --- |
| 背景 | 石墨黑 `#0b0d11` |
| 道路 | 灰藍 `#3d4e64`–`#6d87a3` |
| 導航路線 | 青藍 `#3ee0ff` |
| CCTV | 紫 `#7c3aed` / `#c084fc` |
| 事故 | 紅 `#ff3b3b` |
| 壅塞 | 橘紅 `#ff6b35` |
| 災害 | 琥珀橘 `#ff9f1c` |

底圖來源：[OpenFreeMap](https://openfreemap.org/) Dark，再覆寫成駕駛模式並降低 POI／次要地名密度。3D 模式會擠出建物。

MapLibre GL JS 6 的向量圖磚依賴 Web Worker。Next.js 打包後預設 worker 路徑會失效，因此 `src/app/maplibre/[file]/route.ts` 會從本機 `node_modules` 提供 `maplibre-gl-worker.mjs`。

## Roadmap

**Phase 1（本 repo）** 臺南駕駛 Prototype、mock CCTV／交通／災害、HUD 導航與情報卡。

**Phase 2** 串接 [TDX](https://tdx.transportdata.tw/) 即時 CCTV 影像與 Live Traffic，服務層已預留 `fetchTainanCctv` / `fetchTainanTraffic`。

**Phase 3** 真實路徑規劃、車頭方向與 GPS heading 對齊、語音轉向。

**Phase 4** 正式防災來源（NCDR 或地方防災），推播級災害與封路。

**Phase 5** 擴充到全臺城市切換、離線快取、車機／PWA 佈局。

## 授權

Prototype 僅供展示。OpenStreetMap／OpenFreeMap 圖資依其授權標示。TDX 正式使用需申請 MOTC 帳號並遵守其條款。
