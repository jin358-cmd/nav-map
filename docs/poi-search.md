# 全台 POI Search MVP

只使用第一組已確認來源：OpenStreetMap（ODbL）、NLSC／TGOS 地址後備、既有 Local Index。Google Places 維持停用。

## 架構

1. 可控批次 `npm run ingest:pois` 從 OSM 寫入 `src/data/taiwan-poi-index.json`。
2. 每筆保留 `source`、`sourceId`、`updatedAt`。
3. 搜尋只在 server 跑。Android 只拿到 5～8 筆（可按顯示更多）。
4. Local Index 命中高品質結果就立刻回傳；地址或結果不足才走 NLSC／OSM fallback。
5. Supabase `taiwan_poi_index` 已備 schema；未設定金鑰時使用 server JSON。

## 排名

- 品牌／類別＋GPS：Nearby 優先。
- 明確地點（臺北車站、奇美博物館）：Exact 優先，不因人在臺南而排除。
- 同一 POI 以名稱＋座標去重。
