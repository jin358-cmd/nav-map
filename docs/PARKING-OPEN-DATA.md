# 停車場 Open Data（公有＋民營）

附近停車場圖層同時收公有與民營場。連鎖品牌沒有對外開放的場站 API，改接已公開、可對接的官方與圖資來源。

## 可對接來源

| 來源 | 端點 | 含民營 | 即時剩餘 | 金鑰 |
| --- | --- | --- | --- | --- |
| 臺南市停管 | `https://parkweb.tainan.gov.tw/api/parking.php?mode=0` | 是（`typeName=民營停車場`，如城市車旅、竑穗） | 有 | 否 |
| 臺北市停管處 | `TCMSV_alldesc.json` + `TCMSV_allavailable.json` | 是（嘟嘟房、台灣聯通等） | 有 | 否 |
| TDX 路外停車場 | `/v1/Parking/OffStreet/CarPark/City/{City}`、`ParkingAvailability`、`Operator` | 是（`IsPublic=0`、`OperationType=3` 私有民營） | 視業者上傳 | `TDX_CLIENT_ID` / `TDX_CLIENT_SECRET` |
| OpenStreetMap | Overpass `amenity=parking`（排除住戶專用） | 是（`brand`／`operator`／名稱） | 無，不造假 | 否 |

嘟嘟房、台灣聯通、格上、俥酷等連鎖**沒有**給第三方用的公開場站／剩餘車位 API。業者把資料交給縣市停管後，再匯入 TDX 或北市／南市 Open Data。圖層用名稱與營運業者比對品牌。

## 流程

各 Provider 清洗 → 記憶體快取（北市／TDX／OSM）或 Supabase（臺南）→ `GET /api/parking/nearby` 合併去重 → 地圖圖層。

80 公尺內且名稱相近視為同一場，優先保留有即時剩餘的來源。

## 資料表

套用 `supabase/migrations/20260906_parking_open_data.sql`：

- `parking_lots`
- `parking_availability`
- `parking_rates`
- `parking_sync_logs`

Service Role 只能放伺服器端 `SUPABASE_SERVICE_ROLE_KEY`，不可進前端或 Git。

## API

- `GET /api/parking/nearby?lat=&lng=&radius=1000`
- `GET /api/parking?lat=&lng=&radiusKm=3`（相容舊呼叫）
- `POST /api/parking/sync`（可選 `PARKING_SYNC_KEY`，目前同步臺南來源）

半徑單位：nearby 為公尺，預設 1000。目前位置搜尋 3000 m，目的地附近 1000 m。

即時車位超過 10 分鐘未更新標 `stale`。沒有剩餘格數時顯示「即時剩餘車位目前無資料」，不推算假資料。
