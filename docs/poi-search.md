# 全台 POI Search（Phase 5.2 P0）

只使用合法來源：OpenStreetMap（ODbL）、NLSC／TGOS 地址後備、既有 Local Index。Google Places 維持停用。經濟部公司／商業登記**不會**整批當成可導航店家。

## 架構

1. `npm run ingest:pois` 以 OSM Overpass 寫入 `src/data/taiwan-poi-index.json`（Photon 後備：`npm run ingest:pois:photon`）。
2. 每筆保留 `source`、`sourceId`／`source_id`、`name`、`normalized_name`、`aliases`、`brand`、`branchName`、`category`、`address`、`normalized_address`、`city`、`district`、`lat/lng`、`updated_at`、`confidence`、`is_active`。
3. 搜尋只在 server 跑。Android 只拿到 5～8 筆（可按顯示更多）。
4. 輸入 1 字即走 `/api/suggest`：Prefix → Alias／Brand → Local Fuzzy；本地沒有才 fallback。
Photon 回傳必須名稱與品牌相符，否則不寫入（避免「711」命中地政事務所等）。經濟部公司登記腳本 `npm run ingest:company-registry` 預設拒絕匯入。

## Suggest

- Debounce：110ms
- 最短字數：1
- 舊請求：AbortController + generation id
- 熱門 query cache：`query + geohash(4) + version`，Nearby 不跨區

## 排名

1. Exact → 2. Prefix → 3. Alias → 4. Brand → 5. Strong fuzzy → 6. Nearby → 7. Category → 8. Confidence  
品牌／類別＋GPS：Nearby 提高權重。明確店名／地名：Exact 優先於距離。
