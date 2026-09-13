# Phase 5.3A 門牌搜尋品質（§17）

資料版本：`south-address-nlsc-derived-south-pilot-20260913-batch10`  
分支：`cursor/phase-5-3a-south-poi-cloud-pilot-5225`

## 已完成

- 台灣地址 parser：台／臺、全半形、郵遞區號、重複行政區、中文段巷弄鄰、之號／`12-3`／`12號之3`、附號、樓室分離、無路名村鄰號、庄／部落。
- 地址意圖不再被本機 POI 提前攔截；autocomplete 不呼叫 OSM。
- 結構化評分：門牌／路／段／巷／弄／縣市／行政區；快取不加分；道路中心不可標精確門牌；錯縣市不得當 exact-house 第一名。
- 搜尋結果分組：精確門牌／推估門牌／附近巷弄／店家。
- Additive migration：`20260913_phase53a_address_index.sql`（未套用到任何雲端專案）。
- 1,000 筆南部回歸集；`npm run test:address`。
- **本機南部門牌 staging**：從已定位 POI／NLSC 配對去重，寫入 `src/data/south-address-index.json.gz`。搜尋在沒有 Supabase 時走此檔。**不是**各縣市合法門牌原始檔。
- **行政區驗證**：22 縣市粗包箱；南部鄉鎮區包箱由已定位點衍生。沒有官方多邊形，不標完成界線驗證。
- **失敗重建＋單次重試**：GCIS 目錄 748,302 筆與 ingest 一致；目前未定位 3,995（含 Batch 10 的 2,121 與歷史殘留）。改善 query（無路名保留村／里／鄰）後重打 3,995：nav-ready 1,705、review 2,277、仍空 9、傳輸失敗 4。南部 nav 462 筆，其中 421 併入本機索引。巷弄／道路中心未自動 nav-ready。

## 缺件（仍不得冒充完成）

| 缺件 | 現況 | 仍缺 |
| --- | --- | --- |
| 各縣市合法門牌原始檔 | `ADDRESS_DOORPLATES_DIR` 可吃官方 CSV／GeoJSON；未設定時南部為 `nlsc-derived`，其餘 `NOT CONFIGURED` | 未授權縣市原始檔不得標 official |
| 未確認 NavPilot Supabase | 本機 staging + local advisor；`ADDRESS_INDEX_APPLY=1` 仍拒絕寫庫 | 不能寫 `taiwan_address_index`、不能跑雲端 advisors |
| 行政區界線多邊形 | 縣市包箱 + 衍生鄉鎮框 | 官方多邊形未提供 |
| Batch 10 的 2,121 筆 | 已重建並單次重試 | 未進入 POI 索引／雲端表；道路中心不自動 nav-ready |

因此 **線上 Top 1／P95、官方門牌可查** 仍不能標記完成。

## 指令

```bash
npm run build:address-index      # 建南部 NLSC 衍生 staging
npm run import:doorplates        # dry-run；設 ADDRESS_DOORPLATES_DIR 讀官方檔
npm run reconstruct:nlsc-fails   # 重建 Batch 10 失敗列
npm run retry:nlsc-fails         # 單次重打 NLSC
npm run advise:address           # 本機 advisor，不連 Supabase
npm run test:address
```

## 結論

**CONDITIONAL PASS**（parser／分流／評分／本機 staging／縣市包箱／失敗重建＋單次重試完成；官方門牌雲端與正式界線待資料）。未 merge `main`，未 Production Deploy。
