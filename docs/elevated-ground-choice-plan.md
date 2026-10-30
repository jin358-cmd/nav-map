# 高架／平面選擇（導航中）

導航進行中，車在路線上距離「一條上路、一條留在橋下」的分岔 200 公尺以內時，顯示「走高架」「走平面」。其餘時間完全不顯示。既有偏離路線重算、TDX、停車、POI、Supabase 與 API 金鑰都不改。`SHOW_GUIDANCE_ARROW_MODE_TOGGLE` 維持 `false`，那個平面／立體箭頭樣式開關是另一件事，不拿來重用、也不重新打開。

## 現有 OSRM 實際支援什麼

車路預設打到 `https://router.project-osrm.org/route/v1/driving`（`OSRM_CAR_URL` 沒設時）。`/api/directions` 目前固定 `overview=full&geometries=geojson&steps=true&alternatives=false`。機車仍只走 `OSRM_MOTORCYCLE_URL`，沒設就 501，這次不改。

對公開 demo 與本機 `osrm/profiles/car.lua`（鏡像裡的 car profile）實測與讀碼：

| 能力 | 結果 |
| --- | --- |
| `alternatives=true` | 請求參數，demo 與 `osrm-routed` 都接受。建國北路三段（121.53680, 25.06420）到仁愛路（121.53715, 25.03740）只回 1 條：民權東路入口匝道 → 建國快速道路。沒有橋下那條。 |
| `exclude=bridge` | 公開 demo 回 HTTP 400 `InvalidValue`：Exclude flag combination is not supported。 |
| profile 的 `excludable` | 只有 `toll`、`motorway`、`ferry`。`classes` 另有 `restricted`、`tunnel`，沒有 bridge。 |
| `bridge` 標籤 | `process_way` 有讀，只餵可開啟橋的速度（`bridge_speeds.movable`）。沒有編成可排除類別，也沒有進 annotation。 |
| `annotations=true` | 回 `nodes`、`distance`、`duration`、`datasources`、`weight`、`speed`。沒有 `bridge` 或 `layer`。路口物件只有 `bearings`、`entry`、`location`，沒有 `classes`。 |
| 途經點 | 路徑 `lon,lat;lon,lat;lon,lat` 加上 `radiuses=unlimited;30;unlimited` 可用。同一起訖，途經南下高架主線得到建國快速道路（3044 m、232 s）；途經橋下平面得到建國北路二段 → 一段 → 建國南路一段（3045 m、325 s）。兩條在建國北路三段重合，到仁愛路再會合。 |

因此不改 OSRM profile、不重建圖、不加 `exclude=bridge`。那需要重新 extract。候選路線只靠請求參數：先 `alternatives=true`；分不出高架／平面時，再用一組途經點各打一條。新的小路由是 `GET /api/directions/fork`，既有 `/api/directions` 仍是 `alternatives=false`。

## 怎麼判斷是高架／平面分岔

OpenFreeMap Liberty 的向量圖磚（`openmaptiles` / `transportation`）才有橋的屬性。樣式用 `brunnel == "bridge"` 與 `ramp == 1` 過濾。解碼 planet 圖磚 `14/13723/7013`（版本 `20261025_080012_pt`）後，屬性含 `brunnel`、`layer`、`ramp`、`class`。建國高架是 `class=trunk`、`brunnel=bridge`、`layer=1`。正下方的建國南北路是 `class=tertiary`，沒有 `brunnel`。匝道是 `ramp=1`，不是 `highway=*_link` 這個字串。z15 以上該格是空圖磚，客戶端 overzoom z14，所以 `querySourceFeatures` 讀到的是已載入的 z14 圖徵。

衛星底圖沒有 `openmaptiles`，讀不到橋，就不提示。

判定（純函式，測試用圖徵，不打網路）：

1. 兩條線都從同一段出發，中間分開，之後再重合，或兩條都接到同一個終點。
2. 「同一條路」的門檻是橫向 12 公尺。建國這組高架與平面只隔約 15–40 公尺，用 25 公尺會把上下兩層看成同一條。
3. 只在分開的那一段算每條路線到「高架車道中心線」的中位數距離。高架車道是 `brunnel=bridge` 或 `layer>0`，且 `class` 為 motorway／trunk／primary／secondary。人行、軌道、service 不算。
4. 較近的那側中位數 ≤ 10 公尺，另一側 ≥ 12 公尺，而且兩者相差 ≥ 8 公尺，才算一組高架／平面。建國平行段實測：高架中位數約 0.3 公尺，平面約 15 公尺。
5. `ramp=1` 或名稱以 `_link` 結尾只代表匝道，單獨不算高架。匝道要同時有 `brunnel=bridge` 或 `layer>0` 才算高架幾何。
6. 分開段短於 80 公尺或長於 8 公里就丟掉。決策點是分開前最後一個重合點，沿目前路線的里程。

OSM 若把高架和橋下畫在同一條中心線上，兩邊中位數都會接近 0，分不出來，就不提示。圖磚簡化後若平面也被算進橋的 12 公尺內，同樣不提示。

## 觸發

只在 `navigating === true`、沒有偏離路線、這個分岔還沒選過也沒被略過時考慮。

- 沿路線，決策點在車前方 0–200 公尺：進入提示。需要連續兩個取樣都落在窗內，避免一次 GPS 跳點就閃出來。
- 已經顯示時，前方 240 公尺到後方 15 公尺仍保持，吸收抖動。超過就關掉。
- 車過了決策點 20 公尺，或選了一側，或 12 秒倒數結束：關掉，而且同一個分岔不再出現。倒數結束等於維持目前路線。
- 偏離路線：立刻隱藏，交給既有重算。選擇不會把車標成偏離，也不會走 `rerouteFromHere`。

## 候選路線怎麼拿、失敗怎麼辦

導航中、旗標開著、而且前方約 1.5 公里的路線靠近高架圖徵時才調查：

1. 每個分岔格（決策點四捨五入到約 100 公尺）加目的地只查一次。負結果在車再走 400 公尺或 60 秒前不重試。兩次 OSRM 調查至少隔 20 秒。
2. 先 `alternatives=true`。分得出高架／平面就用。
3. 否則最多再打兩次途經點：一點在高架中心線上、一點在 12–45 公尺外的非高架車道上（tertiary／primary／secondary／trunk），`radiuses` 把途經點吸在 30 公尺內。
4. 沒有第二條、OSRM 逾時、途經點吸到匝道造成大繞路（與另一條橫向差太多或長度差超過 2 倍且沒有會合）、或分類不成立：不顯示。
5. 路線重算（`routeEpoch` 或幾何換掉）清掉目前提示，不套用過期的另一條。快取可以留。

換路線時直接置換座標、步驟、距離與時間，用目前車位在新幾何上重算進度。兩條在決策點前重合，所以車還在共用前綴上，鏡頭繼續跟車，不呼叫全線 `fitBounds`，也不亮「重新規劃」狀態。

## 介面

兩個並排大按鈕，文案「走高架」「走平面」。各顯示相對目前路線的時間差與距離差。目前這條標「目前」。點擊區至少 44×44 px（實作用約 52 px 高）。12 秒後自動消失並維持目前路線。

位置：直式在速度 HUD 上方、右側功能鍵左側，不蓋導航橫幅、路口卡、速度 HUD。橫式改放右下，讓出左側路口卡與右側直排按鈕。直式與橫式都要能一眼看完。

## 功能旗標

`NEXT_PUBLIC_ELEVATED_GROUND_CHOICE`。`next.config.ts` 在建置時寫入：有明確設定就用設定；否則 `VERCEL_ENV=production` 為關，preview 與本機開發為開。客戶端沒讀到 `VERCEL_ENV` 時才需要這層。旗標關閉時不查 OSRM、不渲染面板。

開發用 `?egFixture=near|far` 只在 `NODE_ENV !== "production"` 生效，把車放在建國高架分岔前 120 公尺或 400 公尺，路線與橋線是上面那組實測幾何。這個參數把自動消失拉長到 90 秒，方便截圖；行車中的邏輯仍是 12 秒。正式與 preview 建置不會啟用這個查詢參數。

## 會改的檔案

- `src/lib/osrm-route.ts`：`buildOsrmRouteUrl` 增加可選的 `alternatives`、途經點、`radiuses`。預設仍是單一路線、`alternatives=false`。
- `src/app/api/directions/fork/route.ts`：新的小路由。不改 `/api/directions`。
- `src/lib/elevated-ground/*`：旗標、分岔判定、200 公尺觸發、圖徵整理、途經點挑選、速率限制、建國 fixture。
- `src/lib/__tests__/elevated-ground-fork.test.ts`、`elevated-ground-trigger.test.ts`。
- `src/hooks/use-elevated-ground-choice.ts`、`src/components/overlay/elevated-ground-choice.tsx`。
- `src/components/driving/driving-app.tsx`：導航中掛上面板，換線不走偏離重算。
- `src/components/map/driving-map.tsx`：導航中偶爾回傳已載入的車道圖徵。
- `src/app/globals.css`：直式與橫式位置。
- `next.config.ts`：旗標預設值。

不改 TDX、停車、POI、Supabase、API 金鑰、`guidance-arrow-mode.ts` 的開關、OSRM profile 或 docker compose。

## 限制

- `alternatives=true` 在這組建國路線上不給橋下方案，要靠途經點。途經點若吸到對向或匝道，OSRM 會繞遠，該次就放棄提示。
- 橋的幾何來自畫面已載入的 OpenFreeMap 圖磚。分岔還沒進入視野時不會調查；衛星底圖沒有向量車道。z14 圖磚很粗，中心線可能偏 10 公尺以上。
- 上下層共用中心線時分不出來。
- 公開 OSRM demo 有速率限制，所以要快取與間隔。它也不是本機台灣圖，幾何可能和 OpenFreeMap 圖磚有落差。
- 選擇只比較這兩條候選，不重新做交通加權，也不改 TDX 路況。
