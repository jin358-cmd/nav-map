# Phase 5.3A Supabase 上傳狀態

檢查時間：2026-09-14T03:54:18.375Z
資料版本：`south-pilot-20260913-batch10`

## 結論

**NOT UPLOADED** — 沒有 NavPilot Supabase 金鑰，雲端列數為 0（未連線）。

## 本機檔案

| 項目 | 狀態 |
| --- | --- |
| 來源索引 | `/tmp/phase53a-src/taiwan-poi-index.json.gz`（SHA 相符） |
| 匯出摘要 | candidates 236,645／published 179,601 |
| import checkpoint | dry-run／upserted 0 |
| 南部門牌 staging | src/data/south-address-index.json.gz |

## 雲端

| 項目 | 狀態 |
| --- | --- |
| SUPABASE_URL | 未設定 |
| SERVICE_ROLE | 未設定 |
| 專案 ref 確認 | 未確認 |
| 阻擋原因 | missing_credentials |
| taiwan_poi_index 本版本 | 未連線 |
| taiwan_poi_index published | 未連線 |
| taiwan_address_index | 未連線 |
| migrations 套用 | 未連線 |

## 門牌

南部門牌目前是 NLSC 衍生 staging，**不是**各縣市合法門牌原始檔。未確認專案前不寫 `taiwan_address_index`。

## 下一步（確認 NavPilot 專案後）

1. 在 SQL editor 依序執行 `supabase/migrations/20260905_taiwan_poi_index.sql` 與 `20260913_phase53a_south_poi_cloud.sql`（只 additive，不 TRUNCATE）。
2. 設定 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`NAVPILOT_SUPABASE_PROJECT_REF`（須與 URL 主機名一致）。
3. 先 dry-run：`npm run import:south-pois`。
4. 先上傳雲林：`SOUTH_POI_APPLY=1 SOUTH_POI_COUNTIES=雲林縣 SOUTH_POI_PUBLISHED_ONLY=1 npm run import:south-pois`。
5. 對帳通過後再其餘五縣市；最後才考慮門牌（仍需官方檔才標 official）。

禁止寫入 GVG／租屋雷達專案。禁止自建未授權付費專案。禁止 `NEXT_PUBLIC_` 放 service role。

