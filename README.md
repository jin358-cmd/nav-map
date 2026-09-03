# NavPilot

智駕台灣。駕駛視角的道路情報地圖，不是 Google Maps 克隆。

第一階段 Prototype 以 **臺南市區** 為示範範圍（中正路北上，民生路口右轉往臺南火車站）。Phase 2 已把 weather 專案的 CCTV 篩選／距離／city+freeway 模型移植到 MapLibre Driving HUD。Phase 3 已接 TDX 臺南市區即時路況，無憑證或 live 失敗時走 mock。Phase 4 已接 NCDR 民生示警，feed 失敗時走 mock。

## 技術架構

| 層 | 技術 |
| --- | --- |
| 框架 | Next.js 16 App Router、TypeScript |
| UI | Tailwind CSS 4、shadcn/ui |
| 地圖 | MapLibre GL JS 6、OpenFreeMap 向量圖磚 |
| 部署 | Vercel（Next.js 原生） |

資料流維持分離：

`components`（UI）→ `services`（資料存取）→ `data`（mock／CCTV snapshot）或 TDX／TGOS／防災 API。

```
src/
  app/                      App Router、MapLibre worker、/api/traffic、/api/disasters、/api/speed-enforcement
  components/
    driving/                全螢幕駕駛 HUD 組合
    map/                    MapLibre、Vehicle Marker、控制鈕
    overlay/                導航列、道路情報卡、CCTV 卡
    ui/                     shadcn 元件
  data/                     mock 交通／災害、CCTV snapshot（cctv-fallback.json）
  hooks/                    useCctvView、useTrafficView、useDisasterView
  services/
    cctv.ts                 TDX → snapshot → mock
    tdx-client.ts           MOTC TDX token 與 GET
    traffic.ts              即時路況 live → mock
    speed-enforcement.ts    TGOS 鄰近測速執法設置點
    disasters.ts            NCDR JSON Atom + CAP 正規化與 fallback
    geolocation.ts          瀏覽器 GPS
  lib/                      地圖樣式、CCTV／路況圖層與評分
  types/                    領域型別
```

Dark Driving Mode：石墨黑底、灰藍道路、青綠路線；CCTV 紫、測速黃、事故紅、壅塞橘紅、災害琥珀橘。

## 安裝方式

需要 Node.js 20 以上。

```bash
git clone <repo-url>
cd navpilot
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

頂部可輸入地址或地標。成功選定的目的地會保存在搜尋列上方（最多 6 筆，可點選重用或清除）。建物門牌優先使用[國土測繪圖資服務雲](https://maps.nlsc.gov.tw/)公開地址定位（門牌坐標），再以地政行政區交叉比對；失敗時才走 TGOS（需金鑰）或 OpenStreetMap。導航終點為黃色圓點，外圈持續擴散。選定後搜尋列會收起，改顯示確認列。點 **確認** 後進入駕駛畫面。

## 第一階段已完成功能

- 全螢幕 MapLibre 地圖，預設中心在臺南
- Dark Driving Mode（石墨黑、灰藍道路、青綠路線）
- 駕駛視角 3D：pitch 約 60°，車子在可見駕駛區下方約 30%，前方視野拉長
- 2D / 3D 切換（右側顯示「3D」或「2」）、GPS 定位
- 自訂 Vehicle Marker（不是 Google 藍點）
- CCTV、交通事故、災害：只畫目前畫面內的標記，可見數量隨放大縮小自動增減，底部情報列徽章同步
- 即時路況：獨立 `traffic-source` / `traffic-layer`，TDX live 或 MOCK 後備
- 測速執法：警政署政府開放資料免金鑰 CSV，亦支援 TGOS 環域 API，依地圖中心載入 3–10 公里內點位與速限
- NCDR 即時災害 GeoJSON 圖層（CAP 幾何中心）
- 頂部搜尋：門牌、店家、公司行號、連鎖品牌與縮寫；本機關鍵字可立刻挑選，遠端走 TGOS／NLSC／OSM（Google Places 僅最後補查）。長按地圖可自訂位置並存成最愛書籤
- 底部狀態列中央為 Google 登入：未完成設定時顯示無法使用，不會出現工程變數名稱。設定見 `docs/google-oauth-setup.md`
- 底部狀態列紅心：把目前或已輸入的位置加入最愛
- 導航終點：既有立體圖釘＋圖示外中空黃點，外圈持續擴散；確認後與導航中都保留
- 定位點為道路上方的黃色三角形路標（較先前再放大一倍），不左右晃動
- 點確認後進入駕駛畫面，左上角顯示下一個路口距離；提示卡以實際字級與內距縮小，並用地圖 padding 避開黃色定位箭頭
- 任何時候可用雙指縮放、單指平移檢視；定位鈕回到跟隨
- ChatGPT AI 語音播報轉向（可靜音）；未設定 `OPENAI_API_KEY` 時改用系統中文語音
- 路況範圍常態為車輛 5 公里內與路線沿線；每 5 分鐘於後台自動更新路況與災害
- 底部狀態列可開啟 YouTube Music 小窗；播放後再點一次圖示會縮小小窗，第三次關閉
- 底部半透明 Road Information Card
- Android 直式優先的 Responsive HUD（資訊卡不遮住主要駕駛視野）

未設定 TDX 金鑰時：CCTV 走本地 SNAPSHOT（來自 weather 的 city／freeway JSON），路況走臺南示範線，HUD 顯示「示範路況」。金鑰請放伺服器端 `TDX_CLIENT_ID` / `TDX_CLIENT_SECRET`（不可用 `NEXT_PUBLIC_`），由 `/api/traffic` 伺服器端打 TDX。憑證有效時 HUD 顯示「TDX 即時路況」。live cache 與前端輪詢約 **5 分鐘**；拖曳／縮放地圖不會重打 TDX。token 失敗、timeout、401／429／500 或資料異常時自動 fallback mock，不把密鑰或堆疊傳給瀏覽器。

災害示警由 `/api/disasters` 抓 NCDR 民生示警 JSON Atom，再讀各則 CAP 的 `polygon`／`circle` 幾何中心；沒有座標的示警不會用行政區質心臆測位置。可選填伺服器端 `NCDR_ALERT_FEED_URL`。HUD 顯示「NCDR 即時災害」或「示範災害」。live cache 與前端輪詢約 **5 分鐘**；feed 逾時或解析失敗時 fallback mock。

測速點預設使用警政署在[政府資料開放平臺](https://data.gov.tw/dataset/7320)發布的免金鑰 CSV，因此公開網站可直接顯示。專案內附官方資料快照，來源站逾時時仍可正常載入；執行 `npm run update:speed-enforcement` 可更新快照。若另有 `TGOS_THEME_API_KEY`，會優先使用[內政部主題 API](https://data.tgos.tw/)的「測速執法設置點」（主題 ID `kJqZSMsB`），失敗時自動回到公開資料。環域查詢半徑依縮放層級為 3、6 或 10 公里；查詢結果快取 10 分鐘，公開全臺清單快取 6 小時。

詳見 [`docs/PHASE-3-TRAFFIC.md`](docs/PHASE-3-TRAFFIC.md)。

Phase 2 對照報告：[`docs/PHASE-2-CCTV.md`](docs/PHASE-2-CCTV.md)。  
Phase 3 路況說明：[`docs/PHASE-3-TRAFFIC.md`](docs/PHASE-3-TRAFFIC.md)。  
Phase 4 災害說明：[`docs/PHASE-4-DISASTERS.md`](docs/PHASE-4-DISASTERS.md)。

## Future Roadmap

**Phase 2：CCTV 顯示**  
已完成 weather 邏輯移植與 Driving HUD。CCTV 的 TDX live token 仍是 stub。

**Phase 3：即時交通（本階段）**  
TDX 臺南市區 Live + Section + SectionShape，依壅塞級別／時速上色；無憑證或失敗時保留 mock。

**Phase 4：災害資訊（已完成）**  
NCDR JSON Atom + CAP 取代 mock 積水／封路／強風標記；MapLibre 圖層、點擊詳情、120 秒快取與失敗 fallback。

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
- 環境變數：正式路況用 `TDX_CLIENT_ID` / `TDX_CLIENT_SECRET`；正式戶政門牌定位用 `TGOS_APP_ID` / `TGOS_API_KEY`；測速公開資料不需金鑰，TGOS 主題 API 可選填 `TGOS_THEME_API_KEY`；NCDR 示警免金鑰，會員資料可選填 `NCDR_API_KEY`；Google 登入與 Drive 書籤、YouTube Music 歌單可選填 `NEXT_PUBLIC_GOOGLE_CLIENT_ID`（需啟用 Drive API 與 YouTube Data API v3）

MapLibre worker 由 `src/app/maplibre/[file]/route.ts` 提供，`next.config.ts` 已列入 tracing，避免 serverless 漏檔。

## 授權

Prototype 僅供展示。OpenStreetMap／OpenFreeMap 圖資依其授權標示。TDX 正式使用需申請 MOTC 帳號並遵守其條款。
