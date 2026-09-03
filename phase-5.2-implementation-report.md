# PHASE 5.2 IMPLEMENTATION REPORT

## 1. Git

- 基礎分支：`cursor/feat-phase-5-1-search-oauth-nav-ui-5225`（`eb0e19f`，Phase 5.1 已驗證）
- Phase 5.2 分支：`feat/phase-5-2-navigation-experience`
- 各批次 commit：
  - `b7f298f` `feat(navigation): add route snapping and smooth tracking`
  - `f4515a4` `feat(navigation): add fast reroute and junction focus`
  - `0f50d2b` `feat(map): add saved places and map display modes`
  - `5a452b5` `feat(routing): add car and motorcycle route modes`
  - `d9803a0` `fix(events): remove demo data and link traffic event layers`
  - `7056f02` `feat(parking): add simplified nearby parking layer`
  - `92fe982` `fix(youtube): repair playlist authorization and deployment setup`
  - `4c7685a` `chore: keep Phase 5.2 lint clean and refresh README`
  - `ffaa480` `chore: strip trailing whitespace from Phase 5.2 docs`
- 是否 push：否
- 是否 merge：否（未 merge `main`）
- git status：工作區乾淨；報告與 patch 另以文件提交

## 2. 導航貼路

- 原始 GPS 與顯示位置如何分離：React `vehicle` 只寫入 `rawPosition`（GPS）。畫面黃色箭頭使用 `displayVehicle`／`DisplayPose`（`snappedPosition` + `routeProgress` + `snapConfidence`）。吸附結果不得回寫 GPS。
- 吸附門檻：`src/lib/route-snap.ts`
  - accuracy > 50m 不吸附
  - 距離門檻 `max(22, min(55, accuracy * 1.6))`
  - 行進中方向差 > 55° 不吸附
  - 最近點遠離目前進度窗口視為平行路，拒絕
  - `snapConfidence < 0.48` 不吸附
- 如何避免吸到平行道路：只在目前路線進度前後合理範圍找候選；最近點若在進度窗外且距離夠遠則判定平行路。
- Marker anchor／offset 檢查結果：`vehicle-marker` 使用 `anchor: "center"`，根節點沒有 CSS `translate`／錯誤 offset。PASS

## 3. 平滑移動

- 插值方式：`requestAnimationFrame` + `stepVehicleDisplay`；經緯度 `lerp`，方向角 `lerpAngle`（處理 359→1）。
- 更新頻率：每幀，`dt` 上限 0.05s。GPS 更新只改目標，不重開衝突動畫。
- Camera 跟隨方式：跟隨中用 damped `jumpTo` 逐步靠近目標，不用每次定位硬切。手動拖曳暫停跟隨。
- 預測限制：依車速短預測，上限約 16m，不得無限外推；新 GPS 到達後重設預測並校正。靜止不漂移。
- 高頻更新走 ref／Marker API，不每幀整頁 setState。PASS

## 4. 偏航重新規劃

- 偏航判斷條件：與路線距離、GPS accuracy、連續 2 次（accuracy > 28m 則 3 次）、行進方向背離、錯過應轉彎路口、平行道路。單次漂移不重算。
- 觸發時間：確認偏航後立即送出 reroute；成功 cooldown 8 秒，兩次啟動至少間隔 2.5 秒。舊 request 用 AbortController + generation token 取消／丟棄。
- 實測重新規劃時間：此環境沒有實車 GPS 路跑。NOT AVAILABLE
- 失敗處理：繼續顯示目前導航，不跳回總覽；超過 5 秒顯示「仍在重新規劃路線」；失敗顯示錯誤，不假裝成功。PASS（邏輯）／PARTIAL PASS（實車時間）

## 5. 路口強化

- 50 公尺進入條件：`distanceToNextMeters <= 50`；退出 `> 65`，避免 49～51 閃爍。
- 黃色提示卡：`.navigation-instruction-card--junction`，高對比深色字與粗箭頭，距離最醒目；保留轉向、道路名、語音鈕。一般狀態維持原主題。提示卡約放大 20%–30%，左上角 + safe-area，橫向寬度 ≤ 40vw，不用 `transform: scale`。ResizeObserver 同步 Camera padding。
- Zoom 範圍：一般巡航 zoom 漸進插值到路口 zoom（約 18.25–18.65）；中心兼顧車輛、轉彎點與轉彎後短路線。
- 通過路口後恢復方式：離開 65m 門檻後 `junctionZoomProgress` 回 0，平順回到一般導航 zoom。不改北向上／車頭向上。PASS

## 6. 常用地點與地圖模式

- 儲存方式：`localStorage` `navpilot.saved-places.v1`，`SavedPlace`（home／work／custom）。無寫死私人地址。
- 自訂名稱：只改 `displayName`，不改經緯度。可修改與刪除。
- 經緯度選點：地圖點擊立即放 Pin，顯示 lat／lng 至 6 位；反查不到地址仍保留座標；確認後才儲存。衛星模式可選點。
- 亮／暗／自動／衛星：自動 06:00–16:59 亮、其餘暗，裝置時區，後備 `Asia/Taipei`，跨過門檻會切。衛星為 Esri World Imagery + CARTO 路名，非 Google 圖磚，有 attribution。style 重載後重掛自訂圖層；失敗退回暗色並提示。
- 2D／3D：圖示尺寸不變，文字約 18px；只改 pitch。
- 定位按鈕狀態：第一下定位＋車頭向上跟隨；第二下北向上跟隨；再點循環。手動拖曳暫停，再點恢復。PASS

## 7. 汽車與機車

- Routing Provider：
  - 汽車：公開 OSRM `https://router.project-osrm.org/route/v1/driving`
  - 機車：僅在伺服器設定 `MOTORCYCLE_ROUTING_URL` 時啟用。未設定回 501 `NOT CONFIGURED`。禁止用腳踏車 profile 冒充機車。
- 是否真實支援兩種模式：汽車 PASS。機車 NOT CONFIGURED（未提供機車路由端點）。
- 時間、距離與 ETA：路線預覽顯示交通模式、距離、行駛時間、預計抵達時鐘、開始導航。切換模式會重新規劃。PARTIAL PASS

## 8. 事件資料

- 已移除的示範資料：正式流程不再載入台南示範路線／模擬導航、不再在 TDX／NCDR 失敗時自動填 mock。Production 永遠關閉；僅 `NEXT_PUBLIC_ENABLE_DEMO=1` 可開「示範資料」標示。
- 各圖層真實來源：
  - 導航路線：OSRM 規劃結果（source 名稱沿用 `demo-route`，是正式路線不是 mock）
  - 壅塞：TDX Live，失敗則空圖層
  - CCTV：TDX live（尚未接）或 SNAPSHOT，失敗則空
  - 事故／施工：TDX Incident／News，失敗則空
  - 災害：NCDR，失敗則空
  - 停車場：TDX 或臺南市停車動態，失敗則空
- Source ID／Layer ID：

| 內容 | Source ID | Layer ID |
| --- | --- | --- |
| 正式導航路線 | `demo-route` | `demo-route-glow`, `demo-route-line` |
| 交通壅塞 | `traffic-source` | `traffic-layer` |
| CCTV | `cctv-source` | `cctv-layer`, `cctv-layer-hit` |
| 災害 | `disaster-source` | `disaster-layer`, `disaster-hit-layer` |
| 事故 | `accident-source` | `accident-layer`, `accident-hit-layer` |
| 施工 | `construction-source` | `construction-layer`, `construction-hit-layer` |
| 測速 | `speed-enforcement-source` | `speed-enforcement-layer`, `speed-enforcement-label-layer` |
| 停車場 | `parking-source` | `parking-layer`, `parking-layer-label`, `parking-cluster-layer`, `parking-cluster-count-layer`, `parking-hit-layer` |

- 狀態列聯動：五個圖示可開關圖層；1 筆 flyTo＋資訊卡；多筆距離列表；Marker 與卡共用 `selectedEvent`。資訊卡含類型、道路、方向、說明、發布／更新、影響、來源、一鍵導航、缺漏顯示「未提供」、freshness `live`／`stale`／`unavailable`。正式環境不用 demo 狀態。
- 圖示修改：壅塞三車排隊、CCTV 鏡頭、施工柵欄、事故紅三角驚嘆號；44px 點擊、aria-label／title、無 emoji。PASS

## 9. 停車場

- 資料來源：優先 TDX `/v1/Parking/OffStreet/CarPark` + `ParkingAvailability`（台南）；未設定或失敗改試臺南市停車動態 `parkweb.tainan.gov.tw`。金鑰只在 Server。
- 即時車位：汽車／機車剩餘與總數；沒有即時資料顯示「車位資訊未提供」。Marker `P25` 等，綠／黃／紅／灰。
- 費率：`FareDescription` 或市府 `chargeFee`。
- 更新時間：`DataCollectTime`／`update_time`，資訊卡顯示來源與最後更新。
- 覆蓋地區：第一階段台南；目的地確認後「附近停車」，預設 4km（3–5km）。
- 無資料處理：不顯示假車位；origin `unavailable` 時「資料暫時無法取得」。MapLibre cluster，更新只改 Source。PASS（程式）／NOT CONFIGURED（此環境無 TDX 金鑰，即時車位未實測）

## 10. YouTube

- 問題原因：Google 登入與 YouTube scope 綁在同一套 token；登入成功被當成已有歌單權限；錯誤只分成 ready／error，無法分辨未設定、origin、API 未啟用、過期。
- OAuth 架構：沿用 GIS token client。登入 scope 為 openid／email／profile／Drive appdata。YouTube 另要 `youtube.readonly`。已授權且 token 未過期則重用。登入不在 iframe。Token 只放 sessionStorage，不放 localStorage，不輸出到正式 console。無 Client Secret。
- 所需人工設定：見 `docs/youtube-playlist-oauth-setup.md`（Origins、YouTube Data API、Vercel `NEXT_PUBLIC_GOOGLE_CLIENT_ID`）。
- 播放清單測試結果：此環境未設定 Client ID，狀態應為「尚未設定」。完整同意畫面／origin／過期路徑需人工。NOT CONFIGURED

## 11. 檢查

| 項目 | 結果 |
| --- | --- |
| lint | PASS（0 error；既有 warning：`place-editor` unused、`use-located-region` deps） |
| typecheck | PASS |
| test | NOT AVAILABLE（`package.json` 無 `test` script） |
| build | PASS |
| git diff --check | PASS |

瀏覽器實機／指定解析度路跑：此雲端環境無法完成實車 GPS、轉向與手機旋轉。NOT AVAILABLE  
程式與靜態檢查已完成。Preview 伺服器可開 HUD 做畫面驗收。

## 12. 尚待人工設定

- Vercel 環境變數：`NEXT_PUBLIC_GOOGLE_CLIENT_ID`；伺服器端 `TDX_CLIENT_ID`／`TDX_CLIENT_SECRET`；選填 `TGOS_APP_ID`／`TGOS_API_KEY`、`NCDR_ALERT_FEED_URL`。禁止 `NEXT_PUBLIC_` 包秘密。`NEXT_PUBLIC_ENABLE_DEMO` 正式環境必須關閉。
- Google Cloud：OAuth Web Client、Authorized JavaScript Origins（本機 `http://127.0.0.1:43145`、Preview、Production）。
- YouTube Data API：啟用 YouTube Data API v3。
- Routing Provider：汽車已用公開 OSRM driving。機車需自備 `MOTORCYCLE_ROUTING_URL`。
- 停車資料 API：TDX 停車或台南市府動態；未設定時可能無點位。
- 衛星圖資授權：目前 Esri World Imagery + CARTO 路名與 attribution。若日後改商用授權來源需再確認條款。

## 13. 最終結論

CONDITIONAL PASS

理由：Phase 5.2 七個功能批次已在驗證過的 5.1 分支上實作，lint／typecheck／build 通過，正式環境不再自動灌假資料。機車路由、Google／YouTube OAuth、TDX 即時車位與實車導航／直橫向路跑仍需人工設定與實機驗收。未 push、未 merge `main`。等待「開始驗收 Phase 5.2」。
