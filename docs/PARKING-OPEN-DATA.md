# 停車場 Open Data（第一階段：臺南）

政府 Open Data → `TainanParkingProvider` → 清洗 → Supabase → `GET /api/parking/nearby` → 地圖圖層。

## 資料來源

[臺南市政府停車場動態資訊](https://parkweb.tainan.gov.tw/api/parking.php?mode=0)

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
- `POST /api/parking/sync`（可選 `PARKING_SYNC_KEY`）

半徑單位：nearby 為公尺，預設 1000。目前位置搜尋 3000 m，目的地附近 1000 m。

即時車位超過 10 分鐘未更新標 `stale`。沒有剩餘格數時顯示「即時剩餘車位目前無資料」，不推算假資料。
