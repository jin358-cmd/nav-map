# Phase 5.3A 南部 POI 雲端試行報告

資料版本：`south-pilot-20260913-batch10`  
來源索引 SHA-256：`657c34315a8ea072f564722607ff4edcce146d76e2af41bcc330d6b0a2fc490f`  
Checkpoint：`gcis-2026-09-13-7120bb79` batch 10／`completed`  
產生時間：2026-09-13T19:14:45Z

## 結論

**CONDITIONAL PASS**

程式、Dry Run 與本機驗收完成。尚未寫入 Supabase、尚未建立本分支 Vercel Preview、尚未做 Android 實機抽樣，因此不得 merge `main`，也不得 Production Deploy。

## Git

- 工作分支：`cursor/phase-5-3a-south-poi-cloud-pilot-5225`（從 `feat/phase-5-2-navigation-experience` 建立）
- 未修改、未推送 `main`
- 未 force-push、未建立 PR（規格要求 Android 抽樣後才開 PR）
- 未提交 57MB／未壓縮 80 萬筆全國索引

## 資料對帳

GCIS 基準與索引對得上：

| 項目 | GCIS 基準 | 索引實測 | 差異原因 |
| --- | ---: | ---: | --- |
| 全國有效索引列 | 805,419 | 812,257 | 含後續 OSM／連鎖等非 GCIS 列 |
| 南部有效候選 | 226,721 | 236,645 | 索引無未定位列，但多了非 GCIS 南部列 |
| 南部已配對 | 206,952 | 236,645 | ＋29,693 非 GCIS；未定位 19,769 不在索引 |
| 南部 GCIS nav-ready | 179,717 | **179,717** | 縣市完全相符，規則未放寬 |
| 預計公開 published | 179,717 | 179,601 | −116：籠統店名／僅縣市地址／明顯縣市衝突 |
| 未定位／拒絕統計 | 19,769 | 0（索引內） | 未定位列不進索引，保留在 GCIS 報告 |
| 重複 `(source, source_id)` | 0 | 0 | 通過 |
| 區域外 published | 0 | 0 | 通過 |

縣市 GCIS nav-ready（與規格 4.2 完全一致）：

| 區域 | 候選（索引） | GCIS 已配對基準 | GCIS nav-ready | published |
| --- | ---: | ---: | ---: | ---: |
| 雲林縣 | 20,298 | 17,611 | 11,516 | 11,515 |
| 嘉義市 | 12,030 | 10,193 | 9,801 | 9,781 |
| 嘉義縣 | 13,616 | 11,472 | 4,543 | 4,538 |
| 嘉義市＋縣 | 25,646 | 21,665 | 14,344 | 14,319 |
| 臺南市 | 73,098 | 63,575 | 56,529 | 56,452 |
| 高雄市 | 93,591 | 82,463 | 78,879 | 78,870 |
| 屏東縣 | 24,012 | 21,638 | 18,449 | 18,445 |
| **合計** | **236,645** | **206,952** | **179,717** | **179,601** |

分類（索引南部列）：食 95,145、衣 14,849、住 69,246、行 17,563、育 7,602、樂 29,315、醫 1,910、生活 1,015。

品質：A 60,674、B 120,847、C 94、D 26,201、E 111、無等級 28,718。

review 原因：未達導航門檻 39,978、僅縣市地址 16,466、明顯縣市衝突 597、籠統店名 62。  
雲林／嘉義縣 nav-ready 比例偏低，主因是商業登記品質與僅縣市地址，不是座標解析失敗。

同址密集點（≥8 筆同一 5 位小數座標）145 處；地圖以 cluster 顯示，不一次疊出大量相同標記。

## Supabase

- 此執行環境沒有已確認的 NavPilot 專用專案，也沒有 `SUPABASE_URL`／`SUPABASE_SERVICE_ROLE_KEY`
- `npm run import:south-pois` 僅 dry-run：預計 upsert 236,645、公開 179,601、約 79 批
- `SOUTH_POI_APPLY=1` 會停止並要求人工確認專案 ref
- 拒絕寫入疑似 GVG／租屋雷達 URL
- 未建立新的付費專案
- migration（additive only）：`supabase/migrations/20260913_phase53a_south_poi_cloud.sql`
  - 擴充 `taiwan_poi_index`：`main_category`、`nav_ready`、`publish_status`、`data_version` 等
  - 新表：`poi_import_runs`、`poi_import_rejects`（補欄）、`poi_data_versions`
  - RLS：anon 只能讀 `published + nav_ready + is_active` 且縣市在南部白名單
  - RPC：`pois_in_bounds`，以 `main_category` 過濾圖層，限制 bounds／筆數
- Advisors：尚未對真實專案執行（無連線）

## API／地圖

- `/api/pois` 先試 PostGIS RPC，失敗或未設定時改讀本機索引
- 預設只回南部 `published + nav_ready`；回應含 `count`、`source`、`dataVersion`、`updatedAt`
- 本機索引若超過 20MB gzip 會跳過，避免把 57MB 全國檔載進 Next.js
- 生活圈抽屜顯示本視野筆數、來源與資料版本
- 語音：未設定 `OPENAI_API_KEY` 或上游失敗時回 200 JSON `{ fallback: true }`，不再使用帶 body 的 204
- NCDR：10 秒 timeout、120 秒快取、最多重試 1 次，失敗不造假

## 驗證

見同目錄 `phase-5-3a-south-poi-dry-run.json` 與 `data/south-pilot/`。

自動檢查：`npm run test:south-pois`、`npm run verify:south-pois`、lint／typecheck／build。

本環境無 NavPilot Supabase、無本分支 Vercel Preview URL、無 Android 實機。Preview 請用本機 `npm run dev`（port 43145）或之後對功能分支開 Vercel Preview。
