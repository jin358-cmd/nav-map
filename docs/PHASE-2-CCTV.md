# Phase 2 CCTV — 實作與 weather 對照報告

Smart Road Taiwan 已把 `jin358-cmd/weather` 的 **CCTV 資料與互動邏輯**移植到 MapLibre + Driving HUD。沒有複製 Leaflet UI、popup、`cameraPane`，也沒有複製災害圖層。

目前 **沒有 push、沒有 deploy**，供你先檢查。

## Phase 2 做了什麼

- 搜尋中心：GPS `active` 用車輛位置，否則用地圖中心。
- 重新整理條件：移動 ≥ 0.35 km、zoom 差 ≥ 0.55、viewport 首次就緒、手動刷新、或 view cache 5 分鐘／catalog cache 15 分鐘。不會每秒打 API。
- 獨立圖層：`cctv-source` / `cctv-layer`（紫色攝影機 symbol）+ 透明 hit circle。不與 traffic / disaster / route / vehicle 共用 layer。
- 圖層順序（下→上）：底圖 → 交通線 → CCTV → 青綠路線 → HTML 車輛／事故／災害標記。
- 點 marker 開底部 HUD CCTV Card（名稱、路口、方向、距離、資料來源、狀態、查看即時影像）。
- 前方道路情報最多列 2 支最近／前方 CCTV，依 `distanceKm` 排序。
- 地圖上只畫 viewport + zoom 上限內的鏡頭（約 4／8／12／16），不會一次掛上全臺南 DOM marker。
- 可用性：`online | offline | unknown | unsupported`。預留 `verifyCameraAvailability`，**不做** luminance 分析。失效 URL 只淡化 marker，不拆地圖。
- 資料：TDX 主來源（credentials 未設時走 stub）→ 本地 `src/data/cctv-fallback.json`（SNAPSHOT）→ 8 支 MOCK。
- 型別：`CctvSourceType = "city" | "freeway"`。Driving 優先：路線前方 → heading 前方（`isCameraAhead`）→ 1 km → 距離。

Fallback 範圍：臺南市區 333 支 + 鄰近國道 160 支，共 493。來源標註為 weather 的 `city_cctv.json` / `freeway_cctv.json` 快照，不是 runtime 抓 GitHub raw。

---

## A. 從 weather 參考了哪些 CCTV 邏輯

| weather（`V1/app.js`） | Smart Road 對應 |
| --- | --- |
| `CITY_CCTV_RADIUS_KM = 1` | 同值：1 km 優先圈 |
| `CITY_CCTV_NEARBY_KM = 8` | 同值：8 km 可顯示圈 |
| `CITY_CCTV_PREVIEW_LIMIT = 6` | 資訊卡候選最多 6；HUD 只列最近 2 |
| `CITY_CCTV_MORE_LIMIT = 40` | 常數保留，地圖改用 zoom cap |
| `FREEWAY_CCTV_RADIUS_KM = 40` | 國道搜尋半徑 |
| `getDistanceKm` Haversine | `distanceKm()` |
| `distanceKm` + `withinLocateRadius` / `withinNearby` | 評分欄位同名 |
| 最近 → 最遠排序 | `scoreCameras()` 先 driving rank 再距離 |
| city / freeway 兩套資料 | `sourceType: "city" \| "freeway"` |
| `isCameraUrlUsable` | URL 協定檢查；失效不拆圖 |
| 維修／無畫面文字 | `MAINTENANCE_PATTERN` → `unsupported` |
| 國道 id 方向碼 `N/S/E/W` | `direction` / `directionLabel` |
| `roadA × roadB` 路口名 | `intersectionRoads()` |
| 地圖只畫 preview，不畫全市 | `mapVisibleCameras()` |
| `BLACK_SCREEN_*`、`CCTV_VISIBLE_LIMIT`、`CCTV_VERIFY_POOL_SIZE` | 常數與 `cctv-availability.ts` 預留 |
| TDX 形狀的 JSON 快照 | 本地 `cctv-fallback.json` |

## B. 哪些部分直接重新實作

- MapLibre GeoJSON `cctv-source` + symbol `cctv-layer`，不是 Leaflet `cctv-points` / `cameraPane`。
- 底部 Driving HUD Card，不是 Leaflet popup，也不是地圖上嵌 iframe。
- `isCameraAhead()`（車輛 heading ±75°）與 `isCameraAlongRoute()`（路線剩餘折線 80 m）。
- zoom / viewport 上限，避免駕駛畫面被鏡頭塞滿。
- 移動／viewport／手動／cache 的節流，而不是 weather 的定位關鍵字重算。
- `TDX LIVE` / `SNAPSHOT` / `MOCK` 來源標籤。
- 紫色攝影機 canvas icon（延續智路視覺，不是 weather 的青藍點）。

## C. 哪些 weather 邏輯不適合 Driving Map，因此沒有採用

- Leaflet UI、popup、`cameraPane`、地圖上每支鏡頭嵌 img／iframe。
- 完整黑畫面 luminance 分析與 `localStorage` 黑名單寫入（常數與 verify hook 已留）。
- 全國／鄉鎮關鍵字搜尋、鄰近交叉路口補名、Google Maps 連結。
- weather 的青藍配色與災害圖層（淹水、停電、地震、避難所）。
- Runtime fetch GitHub raw `city_cctv.json` / `freeway_cctv.json`。
- 把 8 km 內所有鏡頭一次鋪上地圖。
- 國道交流道關鍵字與 40 km 清單式預覽牆（資料模型有 freeway，UI 不做清單牆）。

## D. 資料來源是否一致

| | weather | Smart Road Taiwan |
| --- | --- | --- |
| 執行期主來源 | 打包的 `V1/data/*.json`（當初由 TDX 市區 API + 公路總局國道 CCTV 抓下） | 預留 TDX live；**尚未串真實 token** |
| 目前實際畫面 | 上述 JSON | 從 weather JSON **複製並精簡**成 `src/data/cctv-fallback.json` |
| 標籤 | 快照時間字串 | `SNAPSHOT`（有 TDX credentials 且 live 成功才會是 `TDX LIVE`；再失敗才 `MOCK`） |

**血緣一致，不是同一條 runtime 管線。** weather 的 city 快照時間 `2026-07-09`、freeway `2026-06-26`。Smart Road 沒有在執行期去抓 `github.com/jin358-cmd/weather`。

市區原始 API：`https://traffic.transportdata.tw/MOTC/v2/Road/Traffic/CCTV/City/{City}`  
國道原始 API：`https://thbapp.thb.gov.tw/services/cctv/freeway`

## E. city / freeway 是否都已預留

是。

- 型別：`CctvSourceType = "city" | "freeway"`
- Fallback：333 city + 160 freeway
- 評分：市區用 1 / 8 km；國道用 40 km
- HUD：市區／國道標籤分開
- 未來上國道可切換 freeway 權重，不必改資料模型

Phase 2 示範範圍仍是臺南市區駕駛；國道鏡頭只在距離／前方條件符合時出現。
