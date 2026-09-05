# 全台地址與 POI 資料來源

NavPilot 搜尋不是台南限定。地圖啟動中心可以是台南，但不得當成使用者位置或搜尋預設縣市。

## 已接通（執行期）

| 來源 | 用途 | 授權 | 狀態 |
| --- | --- | --- | --- |
| Supabase `address_search_cache` | 已確認查詢快取 | 隨原始來源 | 需 Service Role，僅 server |
| TGOS | 明確送出後的地址定位 | TGOS 使用條款 | 需 server APPID／APIKEY |
| NLSC | 門牌／地標／反查 | 國土測繪中心條款 | 執行期 |
| OSM／Nominatim | 明確送出後的後備搜尋 | ODbL | 不作 autocomplete |
| OSM POI 索引（Photon／Nominatim 批次） | 全台店家／類別 Local Index | ODbL | server-only `taiwan_poi_index` |

Google Geocoding／Places Web Service 維持 `disabled_by_map_renderer_policy`，不得混入 MapLibre 搜尋鏈。

## 架構已備、資料尚未匯入

| 來源 | 腳本 | 狀態 |
| --- | --- | --- |
| 內政部全國路名 | `scripts/import-taiwan-road-names.mjs` | NOT CONFIGURED |
| 各縣市合法門牌 | `scripts/import-taiwan-doorplates.mjs` | NOT CONFIGURED |
| Overture Places／Buildings | `scripts/import-overture-places.mjs` | DATASET NOT IMPORTED |
| Supabase `taiwan_address_index` | `supabase/migrations/20260904_taiwan_address_index.sql` | NOT CONFIGURED |
| Supabase `taiwan_poi_index` | `supabase/migrations/20260905_taiwan_poi_index.sql` | NOT CONFIGURED（本機 JSON 索引可先用） |

Overture 只補強店家、地標與建築物，不得標成精確門牌。大型 GeoParquet 只能後端 ETL。

## 精度標示

- exact-house：精確門牌
- interpolated：推估門牌位置
- approximate：約略位置
- lane-center：巷弄位置
- road-center：道路位置
- landmark：地標／店家／建築物

除 exact-house 外，畫面不得顯示成精確門牌。

## 座標

統一 WGS84／EPSG:4326。TWD97 必須先轉換並寫入 `coordinate_system`。
