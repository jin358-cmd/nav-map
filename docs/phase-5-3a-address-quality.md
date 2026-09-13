# Phase 5.3A 門牌搜尋品質（§17）

資料版本：`south-address-regression-20260913`  
分支：`cursor/phase-5-3a-south-poi-cloud-pilot-5225`

## 已完成

- 台灣地址 parser：台／臺、全半形、郵遞區號、重複行政區、中文段巷弄鄰、之號／`12-3`／`12號之3`、附號、樓室分離、無路名村鄰號、庄／部落。
- 地址意圖不再被本機 POI 提前攔截；autocomplete 不呼叫 OSM。
- 結構化評分：門牌／路／段／巷／弄／縣市／行政區；快取不加分；道路中心不可標精確門牌；錯縣市不得當 exact-house 第一名。
- 搜尋結果分組：精確門牌／推估門牌／附近巷弄／店家。
- Additive migration：`20260913_phase53a_address_index.sql`（sub_number、attached_number、locality、canonical key、aliases、`search_taiwan_addresses` RPC、南部 published RLS）。
- 1,000 筆南部回歸集（含硬案例），parser 縣市＋門牌 Top 1 = 100%。
- 單元測試：`npm run test:address`。

## 缺件（停止寫庫／停止冒充完成）

| 缺件 | 影響 |
| --- | --- |
| 各縣市合法門牌原始檔未設定 | `import-taiwan-doorplates.mjs` 仍是 NOT CONFIGURED；官方索引無法 staging 匯入 |
| 未確認 NavPilot Supabase | 不能寫 `taiwan_address_index`，不能跑 advisors |
| 行政區界線多邊形未提供 | `region_validation` 南部用粗框，其他縣市標 `unavailable`，不假裝已驗證 |
| Batch 10 的 2,121 筆失敗明細不在 rejects | 只完成既有 rejects 分類，**未重打 NLSC** |

因此 **線上 Top 1／P95、官方門牌可查、2,121 重試結果** 不能標記完成。

## 結論

**CONDITIONAL PASS**（parser／分流／評分／測試完成；官方門牌雲端與失敗重試待人工提供資料與專案）。未 merge `main`，未 Production Deploy。
