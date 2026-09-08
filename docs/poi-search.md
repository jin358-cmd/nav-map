# 全台 POI Search（Phase 5.2 P0）

只使用合法來源：OpenStreetMap Taiwan extract（ODbL）、NLSC／TGOS 地址後備。Google Places／Apple Maps 維持停用。經濟部公司／商業登記**不會**整批當成可導航店家，僅可作品牌別名補充。Photon 只作 Suggest fallback，不當主資料庫。禁止硬編碼假店、禁止把全庫下到手機、禁止前端全量 fuzzy。

## A. 實際資料來源

| 來源 | 角色 | 授權 |
| --- | --- | --- |
| OSM Taiwan PBF（BBBike／Geofabrik） | 主庫，`npm run ingest:pois`（osmium 分批，部署用 `.json.gz`） | ODbL |
| NLSC TextQueryMap | Stage 4 門牌／地名 fallback | 國土測繪公開服務 |
| TGOS 全國門牌 | Stage 4 選用後備（需金鑰） | TGOS |
| OSM Nominatim | Stage 4 地圖地名後備 | ODbL |
| 經濟部公司／商業登記 | **不整批匯入**；`npm run ingest:company-registry` 僅能補品牌別名 | 開放資料，≠ 可導航 POI |
| Photon | 不當主庫；僅搜尋當下 fallback | ODbL |

## B. 各來源筆數（目前索引）

OSM extract：fetched 182203 → inserted **135802**（rejected 37401、inactive 945），再以官網門市更新超商。

目前索引：active **139964**／total **140890**。官方超商抓取：7-ELEVEN **7314**、全家 **4524**（合併後品牌列 7-Eleven 8021、FamilyMart 4993）。便利商店類 **16441**。

主要縣市（含官網門市）：臺北市 36706、臺中市 19352、桃園市 14196、新北市 12968、高雄市 10979、臺南市 9056。

類別摘要：restaurant 34965、convenience 16441、cafe 7976、clinic 4388、parking 4019、supermarket 3185、pharmacy 2000、fuel 1623、hospital 54。

公司登記：`not-imported`。

## C. Supabase schema

`public.taiwan_poi_index` 欄位對應：`source`、`source_id`、`name`、`name_normalized`、`aliases`、`brand`、`branch_name`、`category`、`address`、`address_normalized`、`city`、`district`、`geom`（lat/lng）、`updated_at`、`last_seen_at`、`source_updated_at`、`confidence`、`is_active`。

拒絕列：`poi_import_rejects`。

本機／Vercel 無 SERVICE_ROLE 時，Suggest **只走記憶體索引**，不掃全表、不打 Supabase。

## D. Index

PostgreSQL（有連線時）：`pg_trgm`、GIN（name_normalized、aliases）、prefix `text_pattern_ops`、brand、category、city、PostGIS GIST(`geom`)。RPC：`suggest_taiwan_pois`。

伺服器記憶體：1～2 字 prefix map、brand map、category map、geohash-4／5（Nearby 只掃鄰近格）。

## E. Suggest API

`GET /api/suggest?q=&lat=&lng=&city=&town=`

Stage 1～3 僅本地 prefix／alias／brand／fuzzy。本地 0 筆且 ≥2 字才由客戶端再打 `/api/geocode`（NLSC／TGOS／Nominatim）。

## F. Debounce

**110ms**（`SUGGEST_DEBOUNCE_MS`，範圍 80～150ms）。最短 **1** 字。不必按 Enter。

## G. Request cancellation

`AbortController` + `suggestGenerationRef`／`searchGenerationRef`。新字取消舊請求；舊結果不可覆蓋新 query。

## H. Ranking

Exact → Prefix → Alias → Brand → Strong fuzzy → Nearby → Category → Confidence。品牌／類別＋GPS：Nearby。明確店名或查詢含其他縣市：Exact／該縣市優先。1～2 字會品牌去重。

## I. Alias / Brand

`src/lib/poi/aliases.ts`：全家、全聯、全國電子、7-ELEVEN（含 `7`／`711`）、星巴克、麥當勞、中油等。OSM `brand` 與店名不合（例如巷名被標成 7-Eleven、攤位）會丟掉 brand。

## J. Cache

熱門 query（全家、7-11、星巴克、麥當勞、加油站、停車場、全聯、藥局、醫院、`7`）記憶體 cache。Key：`query + geohash(4) + version`。Nearby 不跨區。

## K. 平均 Suggest latency

本機 `npm run measure:suggest`（6 城 × 19 query）：**平均 HTTP 26ms**（索引已載入）。熱門 query cache 命中約 15–25ms。冷啟動第一次（gzip 解壓＋建索引）約 1.3–1.6s，之後 prefix／品牌 1～2 字多在 **20–40ms**。詳見 `docs/poi-suggest-measure.json`。

## L. Android 真機 latency

**NOT AVAILABLE**（此雲端環境沒有 Android 真機）。請用 Vercel Preview 在手機輸入 1～2 字確認不卡頓、不擋 Map／GPS。

## M. 測試 Query

`全／全家／全聯／7／711／7-ELEVEN／星／星巴克／麥／麥當勞／加／加油站／停／停車場／藥／藥局／醫／醫院／海`，城市：台北、新北、桃園、台中、台南、高雄。1 字「全」回傳全家、全聯、全國電子；「海」在台南會出現海安路附近店家。結果見 measure JSON。

## N. Typecheck / Lint / Build

`npm run lint`、`npm run typecheck`、`npm run build` 均通過。`npm run test` **NOT AVAILABLE**。

## O. Commit hash

`569badd` 之後以 `feat/phase-5-2-navigation-experience` 最新 commit 為準。

## P. Vercel Preview URL

https://nav-map-git-feat-phase-5-2-navigation-experience-tjc1.vercel.app

## 排程

- OSM extract：每週 `npm run ingest:pois`（可續傳 PBF）
- 全國連鎖門市：`npm run ingest:chains`（優先 7-ELEVEN／全家官網地圖；萊爾富／OK 在公開接口可用時一併更新）
- 僅重算中華黃頁圖層：`npm run ingest:pois:classify`
- 關店／改名／搬家：ingest 以 `updated_at`、`last_seen_at`、`is_active` 標記
- `POST /api/pois/sync`（`x-poi-sync-key`）只觸發本機索引狀態，不在 runtime 全量重抓

## 生活圖層

開關只影響地圖圓點顯示，不限制搜尋。切換時客戶端已預抓視野內全部黃頁大類，不再依開關重打 API。分類對齊中華黃頁水平類：食品餐飲、衣著配件、住屋居家、行車運輸、教育文化、休閒育樂、醫療保健。
