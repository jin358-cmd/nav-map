# PHASE 5.2 FINAL VALIDATION REPORT

功能分支：`feat/phase-5-2-navigation-experience`
功能 HEAD：`0f667b102cbf58c759b5742249b15dab20581a07`
報告與 patch 以獨立 docs commit 提交，不納入 A–E 功能 commit，也不自我包含。

最終結論：**CONDITIONAL PASS**

未 merge `main`。未 Production Deploy。未 force push。

---

## 0. 現況盤點（只改 PARTIAL／MISSING）

### DONE（本回合未重寫）

- Android 高精度 GPS：`enableHighAccuracy: true`、`maximumAge: 0`
- TIMEOUT／UNAVAILABLE 重啟 watcher；PERMISSION_DENIED 才停止
- `Permissions-Policy: geolocation=(self), microphone=(self)`
- 共用 geolocation watch；Android 先等權限或使用者手勢
- 測速量化／debounce／Abort／in-flight／快取（前階段已有骨架）
- 路線吸附：`rawPosition`／`snappedPosition`／`displayPosition`／`routeProgress`／`snapConfidence`
- 單一 RAF 平滑、卸載 `cancelAnimationFrame`
- 偏航確認＋Abort＋generation＋5 秒 pending／cooldown
- 住家／公司／自訂、地圖選點、改名不改座標
- 亮／暗／自動／衛星、2D／3D、兩段式定位
- 汽車 OSRM 路線預覽
- 事故／施工／壅塞／災害／CCTV 分開圖層
- 台南優先停車場（失敗不造假）
- Google Identity Services 與 YouTube readonly 分開
- Service Worker 不擋 MapLibre chunks
- 短句導航卡：「200 公尺後右轉」＋道路名稱 ellipsis
- 右側暗灰 zinc 控制列

### PARTIAL（本回合補強）

- 附近查詢／路線起點仍可能被 DEMO／地圖中心誤用 → 已隔離
- 測速與附近 API 可能 request storm → 已加強 abort／key／debounce
- 橫式 HUD／車速／限速／黃箭淺灰圓環 → 已補
- 底部功能列改可收合抽屜 → 已補
- 已走路線仍全段青藍 → 改 remaining／passed
- 羅盤偏慢 → 縮短 heading 時間常數
- 路口 50m 黃卡可能 render-phase setState → 改 `deriveJunctionFocus`
- 地址搜尋預設補「臺南市」 → 已移除

### MISSING → CODE READY／DATASET NOT IMPORTED

- 全國路名／各縣市門牌匯入管線
- Overture 後端 ETL
- Supabase `taiwan_address_index` migration 檔（尚未套用）

### NOT CONFIGURED

- 機車 Routing Provider（`MOTORCYCLE_ROUTING_URL`）
- 道路正式限速來源
- Google OAuth Client ID／Authorized Origins
- YouTube Data API
- TDX（視環境變數）
- TGOS APPID／APIKEY（server）
- Supabase Service Role／migration 套用
- 全國門牌／Overture 實際下載

---

## 1. Git

- 分支：`feat/phase-5-2-navigation-experience`
- 基礎 commit（main，未修改）：`c57777ba7c947d3f462dc035c80ed388a6132d28`
- Android／Portrait 參考（未 reset）：`66bbdfcea6b1d57f883197534e95327fca156260`
- 最終功能 HEAD：`0f667b102cbf58c759b5742249b15dab20581a07`
- 本次新增功能 commits：
  - `40c4309` `fix(android): gate nearby data on live gps and dedupe map requests`
  - `52cbeac` `feat(search): add nationwide Taiwan address data pipeline`
  - `472b49d` `feat(hud): finalize landscape navigation layout and speed display`
  - `518e125` `feat(ui): add collapsible road tools drawer`
  - `0f667b1` `fix(navigation): stabilize junction focus and remaining route rendering`
- 是否 push：YES（僅 `github` 遠端之功能分支）
- 是否 merge main：NO
- 是否 Production Deploy：NO
- 是否 force push：NO
- `git diff --check`（`4cbe676..0f667b1`）：PASS
- 未追蹤且未提交：`phase-5.2-review-bundle.zip`（先前審查包，未加入 Git）
- 未提交秘密：`.env.local` 已被 `.gitignore` 忽略

---

## 2. Android GPS

- 首次 fix：`watchPosition`／使用者手勢 `getCurrentPosition` 後 `source=gps`。跳距 > 80m 直接重置顯示位置，不從台南插值。**PASS**
- timeout retry：TIMEOUT／UNAVAILABLE 延遲重啟 watcher；短暫 timeout 可保留最近一筆 `source=gps`。**PASS**
- permission denied：僅 `PERMISSION_DENIED` 停止並顯示權限錯誤；與麥克風權限獨立。**PASS**
- 地圖 bootstrap：`TAINAN_CENTER`／`DEMO_VEHICLE` 只作開機中心。`vehicle` 仍可先以 DEMO 初始化，但 `source="demo"`。**PASS**
- 真實車輛位置：附近查詢走 `resolveMapQueryOrigin`；`gpsStatus !== "active"` 或 `vehicle.source !== "gps"` 時 origin=null（除非使用者已拖曳地圖）。**PASS**
- 路線規劃／開始導航：無 live GPS 回「尚未取得真實定位，無法規劃路線」，不用 viewport／台南當起點。**PASS**
- 搜尋距離排序：無 GPS 且未拖曳時不用示範座標排序。**PASS**
- Android 實機第一筆 fix／30 秒跟隨：本回合無實機。**NOT AVAILABLE**

---

## 3. Request 效能

- speed-enforcement primitive：`searchLng`／`searchLat`／`radiusMeters`。**PASS**
- requestKey：`` `${searchLng.toFixed(5)}:${searchLat.toFixed(5)}:${radiusMeters}` ``。**PASS**
- debounce：移動查詢 `SPEED_ENFORCEMENT_MOVE_DEBOUNCE_MS`（400ms）。**PASS**
- AbortController：cleanup `controller.abort()`，不只 cancelled boolean。**PASS**
- 同 key in-flight 不重送；成功結果短期快取；`fresh=1` 僅手動重整。**PASS**
- Camera 每幀：viewport emit 另有節流＋量化，不應每幀重抓。**PASS**（程式）
- traffic／disaster：Abort + in-flight key。**PASS**
- parking：量化 primitive + 400ms debounce + abort。**PASS**
- CCTV catalog：cleanup abort。**PASS**

Network 實測（Preview Runtime Logs／Android Chrome）：

| 項目 | 結果 |
| --- | --- |
| 初次載入測速請求數 | **NOT AVAILABLE**（本回合無法讀 Vercel Runtime Logs） |
| 地圖靜止 30 秒請求數 | **NOT AVAILABLE** |
| 導航跟隨 30 秒請求數 | **NOT AVAILABLE** |
| 跨量化區域後請求數 | **NOT AVAILABLE** |
| cancelled request | **NOT AVAILABLE** |
| 是否有重複 request storm | **NOT AVAILABLE**（程式有防護；不得假裝已量測） |

---

## 4. 全台地址資料

不得只寫「已完成」。逐項：

| 項目 | 狀態 | 說明 |
| --- | --- | --- |
| 不再預設補「臺南市」 | **PASS** | `taiwan-address`／normalize／region／reverse／located-region 已改 |
| TGOS | **NOT CONFIGURED**／執行期可接 | 需 server APPID／APIKEY；未設則該 provider 失敗隔離 |
| NLSC | **PASS**（執行期後備） | 明確搜尋／反查；資格依官方條款 |
| OSM／Nominatim | **PASS** | 僅 Enter／搜尋按鈕／明確送出；不作逐字 autocomplete |
| Google Geocoding／Places | **PASS** | `disabled_by_map_renderer_policy`；有 Google Key 也不自動混入 MapLibre 搜尋 |
| 已儲存住家／公司／最愛／歷史 | **PASS** | 第 0 層本地 |
| Supabase 已確認快取 | **NOT CONFIGURED** | 需 Service Role；僅 server |
| 內政部全國路名 | **CODE READY**／**DATASET NOT IMPORTED** | `scripts/import-taiwan-road-names.mjs` dry-run，不造假資料 |
| 各縣市門牌 adapter | **CODE READY**／**DATASET NOT IMPORTED** | `src/lib/address-data/adapters.ts` + manifest；未下載縣市檔 |
| Overture Places／Buildings | **CODE READY**／**DATASET NOT IMPORTED** | 後端 ETL 腳本；禁止塞進瀏覽器 |
| Supabase `taiwan_address_index` | **CODE READY**／**NOT CONFIGURED** | `supabase/migrations/20260904_taiwan_address_index.sql` 未套用 |
| WGS84／EPSG:4326 | **CODE READY** | schema 規定；TWD97 須匯入時轉換並記錄 |
| 授權／attribution | **PASS** | `docs/address-data-sources.md` + manifest |
| 19 縣市門牌抽測 | **DATASET NOT IMPORTED** | 未匯入不得標 PASS |

19 區抽測（完整門牌／路＋段／巷弄／放寬／POI／台臺／之號／樓層室號）：全部 **DATASET NOT IMPORTED**。

臺北市、新北市、桃園市、臺中市、臺南市、高雄市、新竹市、新竹縣、彰化縣、南投縣、嘉義市、嘉義縣、屏東縣、宜蘭縣、花蓮縣、臺東縣、澎湖縣、金門縣、連江縣：同上。

---

## 5. 導航 UI

- 淺灰圓環：箭頭外圍正圓、`#cbd5e1` 系半透明、旋轉只轉三角形。**PASS**（程式／本機）
- 黃色箭頭本體、anchor center、不改路線顏色。**PASS**
- 橫式導航卡在上方、短句＋道路第二行 ellipsis、50m 黃卡。**PASS**
- 左下行程：剩餘時間／距離／ETA。**PASS**
- GPS 車速：km/h、`coords.speed` 優先、平滑、無效 `--`、來源標 GPS。**PASS**
- 道路限速：無可信來源顯示 `--`，不依道路等級猜測。**NOT CONFIGURED**
- 功能抽屜：右側圖層下方四宮格；`aria-expanded`／`aria-controls="navpilot-function-drawer"`；translateY 約 240ms；再開不重抓 API、不清圖層／登入／播放。**PASS**
- 獨立檔 `road-tools-drawer.tsx`：未另拆檔，抽屜實作在 `driving-app.tsx` + `globals.css`。功能 **PASS**

---

## 6. 導航核心

- 貼路：原始 GPS 不被吸附覆寫；可信度不足退回 raw。**PASS**
- 平滑：單一 RAF、卸載 cancel、359°→1° `lerpAngle`。**PASS**
- 羅盤：移動時縮短 heading 時間常數；靜止仍濾波。**PASS**（程式）；實車 **NOT AVAILABLE**
- 已走路線：`remaining` 青藍、`passed` 低透明灰；不改原始 geometry。**PASS**
- 偏航重算：連續偏離＋accuracy＋Abort＋generation＋cooldown；逾五秒保持處理中。**PASS**（程式）；實車計時 **NOT AVAILABLE**
- 50m 進入／65m 退出：`deriveJunctionFocus`；無 render-phase `setJunctionFocus`。**PASS**

---

## 7. 地圖模式與常用位置

- 住家／公司／custom、回家／公司快捷、首次未設定開設定。**PASS**
- 改名不改經緯度、可改位置、可刪、localStorage 保留、無寫死私人地址。**PASS**
- 地圖選點：Pin、緯經六位、反查失敗保留座標、確認才寫入。**PASS**
- 亮／暗／自動（06:00–16:59 亮、其餘暗；當地時區、Asia/Taipei 後備）／衛星街道。**PASS**
- 衛星失敗退回一般地圖；attribution 保留。**PASS**
- 2D／3D：只放大文字約 18px、不重置導航。**PASS**
- 兩段式定位：車頭向上 ↔ 北向上＋箭頭轉向；拖曳暫停跟隨。**PASS**

---

## 8. 即時事件與停車場

- 分類分開：壅塞／CCTV／施工／事故／災害。**PASS**
- 抽屜圖示切層；單筆定位＋資訊卡；多筆依距離。**PASS**
- 缺欄位「未提供」；正式 API 失敗不載 fake。**PASS**
- Production 假資料：僅 `isDemoDataEnabled`。**PASS**
- 停車場：名稱／距離／汽機車格／費用／營業／更新／來源／導航；P marker；綠黃紅灰。**PARTIAL PASS**（覆蓋先台南；TDX／地方源視環境）
- 失敗不造假車位；過期 stale；無即時「車位資訊未提供」。**PASS**

圖層顏色（不得因顏色誤刪正式路線）：

- 青藍：導航剩餘路線
- 低透明灰：已走路線
- 綠／黃／橘／紅／深紅：路況等級
- 紫：CCTV
- 黃柵欄：施工
- 紅三角驚嘆：事故
- 橘系：災害

---

## 9. Google／YouTube

- 不另建第二套 Google 登入。**PASS**
- 登入成功 ≠ YouTube 權限；第一次用歌單才要 readonly。**PASS**
- Client Secret 不進前端；不在 iframe 登入。**PASS**
- Access Token 不過期明文長期方案：沿用現有 hook，不新增長存。**PARTIAL PASS**
- 未設定／API 未啟用／使用者拒絕：不影響地圖。**PASS**
- 文件：`docs/youtube-playlist-oauth-setup.md` 保留。**PASS**
- 本 Preview 環境 Client ID：缺，console 僅提示尚未設定。**NOT CONFIGURED**

---

## 10. 檢查

| 檢查 | 結果 |
| --- | --- |
| `npm run lint` | **PASS**（0 error；既有 warning 2：`place-editor` unused `pickLabel`、`use-located-region` `point` deps。未為消 warning 改規則） |
| `npm run typecheck` | **PASS** |
| `npm run test` | **NOT AVAILABLE**（`package.json` 無 test script） |
| `npm run build` | **PASS** |
| `git diff --check` | **PASS** |

---

## 11. Preview

- 穩定分支 Preview：https://nav-map-git-feat-phase-5-2-navigation-experience-tjc1.vercel.app
- 此 SHA 獨立部署：https://nav-lj0584taq-tjc1.vercel.app
- Vercel 專案：`nav-map`（忽略 `temporary-speedy-fiddle-vmvbydr`）
- Vercel Deployment：https://vercel.com/tjc1/nav-map/DT7kVDC4s4uhN7PrdBJQ4zvmg1pP
- Deployment ID：`DT7kVDC4s4uhN7PrdBJQ4zvmg1pP`
- GitHub Deployment：`6263147641`（`Preview – nav-map`，`production_environment=false`）
- Commit SHA：`0f667b102cbf58c759b5742249b15dab20581a07`
- Build 狀態：READY／success（GitHub `Vercel – nav-map`）
- HTTP：200
- `Permissions-Policy`：`geolocation=(self), microphone=(self)`
- `x-robots-tag`：`noindex`
- Runtime Logs（error／warning／request storm）：**NOT AVAILABLE**
- Android 實機 22 項：**NOT AVAILABLE**（等待「開始驗收 Phase 5.2 Final」）

本機開發伺服器：`http://127.0.0.1:43145/`（Cloud Agent 驗 HUD／抽屜，不能代替 Android 實機）。

---

## 12. 尚待人工處理

- Google OAuth Client ID 與 Authorized Origins（加入上述 Preview 網域）
- YouTube Data API 與 readonly scope
- TDX Client ID／Secret
- 機車 Routing Provider（`MOTORCYCLE_ROUTING_URL`）
- 道路限速可信資料源
- Supabase migration 套用與 Service Role（僅 server）
- 全國路名／各縣市門牌合法下載與可重跑匯入
- Overture release 後端匯入
- Preview Runtime Logs 量測測速請求數
- 乘客協助之 Android Chrome 實機／實車導航（禁止駕駛中操作手機）

---

## 13. 最終結論

**CONDITIONAL PASS**

導航 HUD、GPS 與示範起點隔離、請求去重、功能抽屜、剩餘路線與路口衍生值已在功能分支完成，並通過 lint／typecheck／build，且 Vercel Preview（`nav-map`）對應 `0f667b1` 為 READY。

全國門牌／Overture 資料未匯入、限速與機車 routing 未設定、Runtime 請求數與 Android 實機尚未驗收，故不能標 **PASS**，也不構成 **FAIL**。
