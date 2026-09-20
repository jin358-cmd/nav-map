# NavPilot Phase 5.3 / 5.3A — Codex 交接與待辦

**日期：** 2026-09-20  
**用途：** 交給 Codex 接續執行。本文件是現況快照與閘門，不是授權書。  
**Repository：** `https://github.com/jin358-cmd/nav-map`  
**工作分支：** `cursor/phase-5-3a-south-poi-cloud-pilot-5225`  
**功能 HEAD：** `fad74a4822b02081916c9f212c78c52307374e01`  
**本文件：** 最新 `docs: add Codex handoff` commit（在功能 HEAD 之上）  
**GitHub `main`：** `c57777b`（舊 Production；**尚未**合併本分支）

---

## 0. 一句話現況

導航 HUD（朝上鏡頭、黃色本體／路標、2D 路口 zoom、建議延遲）已在功能分支並 push。  
Phase 5.3A 雲端 **schema 已套用 NavPilot**，雲林 POI **dry-run 通過但未寫庫**。  
Advisor 修正 SQL **只在 Git、未 db push**。原因：Cloud Agent session **拿不到** `SUPABASE_ACCESS_TOKEN`（此 run 沒有 linked environment，Secrets 未注入）。

```text
CONDITIONAL PASS
CLOUD SCHEMA APPLIED
YUNLIN DRY-RUN PASS
NOT CLOUD SECURITY PASS
NOT CLOUD PILOT PASS
NOT PRODUCTION READY
```

---

## 1. 硬性禁止（未另開明確授權前）

- 不得切換或修改 `main`、不得 merge `main`。
- 不得建立 PR（除非 Jin 另開一句明確要求）。
- 不得 Production Deploy。
- 不得 `SOUTH_POI_APPLY=1`。
- 不得匯入雲林或其它縣市 POI 到雲端。
- 不得匯入門牌；NLSC 衍生 staging **不是**官方縣市門牌檔。
- 不得 `supabase db reset --linked`。
- 不得 `DROP TABLE` / `TRUNCATE` / 無條件 `DELETE`。
- 不得碰 GVG／施工流程表專案：`qmptlkgseffmeqnarwnb`。
- 不得把 service role、DB password、Access Token 寫進 Git、Markdown、log、聊天、`NEXT_PUBLIC_*`。
- 不得移動 PostGIS / `pg_trgm` 離開 `public`（已知 WARN，本階段保留）。
- 不得因 unused index、資料為 0 筆而刪除非重複索引。
- 不得 migration repair，除非另開授權。

目標雲端只允許：

```text
NavPilot / rxzbsthsqlozxgctdoks / ap-northeast-1 (Tokyo)
```

---

## 2. 已完成

### 2.1 導航（Phase 5.3 HUD）

已在本分支（含 `f975787`、`fad74a4`）：

| 項目 | 狀態 |
| --- | --- |
| 導航中 camera bearing = 吸附後路線方向（heading-up） | 完成 |
| 黃色本體指標畫面上 0°（viewport，不再跟鏡頭雙重旋轉） | 完成 |
| 黃色 V 路標導航中畫面朝上 0° | 完成 |
| 3D 路標約 2× | 完成 |
| 接近轉彎流水改黃色、scale ≈ 1.42 | 完成 |
| 2D 路口 zoom 加強；轉彎後 delay 0.7s 再 1s 恢復 | 完成 |
| 建議 debounce 80ms；輸入時保留 prefix 舊結果 | 完成 |
| 手機 3D 路標可見／高對比 | 較早 commit 已修 |
| 定位與羅盤分離 | 較早 commit 已修 |

驗收仍以**實車**為準（箭頭大小、黃色對比、路口放大程度）。

### 2.2 Phase 5.3A 搜尋／匯入程式

- 一般搜尋走 **anon key** + `search_taiwan_addresses` / `pois_in_bounds`（SECURITY INVOKER）。
- service role 只用匯入，禁止 `NEXT_PUBLIC_`。
- 門牌 importer：upsert、checkpoint、resume、reconcile；預設 dry-run。
- 拒絕寫入 GVG / `qmptlkgseffmeqnarwnb`。
- Step 1 commit：`ae94134`。

### 2.3 本機資料對帳

| 項目 | 值 |
| --- | --- |
| POI 來源 | `/tmp/phase53a-src/taiwan-poi-index.json.gz` |
| SHA-256 | `657c34315a8ea072f564722607ff4edcce146d76e2af41bcc330d6b0a2fc490f` |
| 南部 published | 179,601 |
| 雲林 published | 11,515 |
| 門牌 unique（本機） | 181,794（exact-house 168,730） |
| 門牌 dry-run | `wouldUpsert=181794`，`wroteSupabase=false` |

### 2.4 遠端 Schema（先前已套用，本 session **未再連線驗證**）

遠端 `supabase_migrations.version`（檔名對齊後）：

| Remote version | 檔名 |
| --- | --- |
| `20260916085144` | `20260916085144_20260904_taiwan_address_index.sql` |
| `20260916085154` | `20260916085154_20260905_taiwan_poi_index.sql` |
| `20260916085203` | `20260916085203_20260913_phase53a_address_index.sql` |
| `20260916085212` | `20260916085212_20260913_phase53a_south_poi_cloud.sql` |
| `20260916085221` | `20260916085221_20260916073635_phase53a_cloud_hardening.sql` |

對齊 commit：`8ab78c0`（5 rename，SQL 未改）。

先前已知遠端（**未在本 session 重查**）：6 張表 RLS ON；POI/門牌列數 0；aliases 4。

### 2.5 Advisor SQL（Git only）

檔案：`supabase/migrations/20260917234436_phase53a_advisor_remediation.sql`  
Commit：`0c271ad`  
**未** `db push`。

內容摘要：

- `search_taiwan_pois` → SECURITY INVOKER + `search_path=public`；EXECUTE 給 anon/authenticated。
- revoke `st_estimatedextent` 三個 overload 對 public/anon/authenticated。
- drop 重複索引：`taiwan_poi_index_name_trgm`、`taiwan_poi_index_geom_gist`、`taiwan_poi_index_source_source_id_uidx`。
- `spatial_ref_sys` 開 RLS；policy `spatial_ref_sys_public_read` SELECT-only。

### 2.6 雲林 POI dry-run

Commit：`049bc8a` / `docs/phase-5-3a-yunlin-dry-run.json`

```text
SOUTH_POI_COUNTIES=雲林縣 SOUTH_POI_PUBLISHED_ONLY=1
wouldUpsert   = 11515
wouldPublish  = 11515
wroteSupabase = false
SOUTH_POI_APPLY = NOT SET
```

### 2.7 本機檢查（導航修正當下）

`lint` / `typecheck` / `build` PASS。  
已知 warning：`local-address-index.ts` filesystem tracing（既有，非新 failure）。

---

## 3. 未完成（依序；每步都要閘門）

### Task A — 讓 Codex／Cloud Agent 真的拿到 Supabase token

**現況阻塞：** 本 VM 沒有任何 `SUPABASE_*`。使用者說已加 Cloud Agent secrets，但 **此 run 沒有 linked environment**，secret **沒注入**。

必須：

1. Secret 名稱：`SUPABASE_ACCESS_TOKEN`（再加 `SUPABASE_DB_PASSWORD` 才能 `link`）。
2. 加在**會啟動 Agent 的 Environment**。
3. **開新的 Cloud Agent**（舊 session 不會自動拿到）。
4. **不要**把 token 貼到聊天、Git、MD。

驗證（只印專案名／ref，禁止印 key）：

```bash
# 只檢查名稱是否存在，禁止 echo 值
printenv | awk -F= '{print $1}' | grep SUPABASE
npx supabase projects list
```

PASS：list 出現 **NavPilot** / `rxzbsthsqlozxgctdoks` / `ap-northeast-1`。  
若出現 `qmptlkgseffmeqnarwnb` 也只能當「看見、禁止操作」。  
若 list 失敗 → **STOP**，不要猜 token。

### Task B — 只 link NavPilot

```bash
npx supabase link --project-ref rxzbsthsqlozxgctdoks
npx supabase migration list --linked
```

確認 linked ref **就是** `rxzbsthsqlozxgctdoks`。不符 → STOP。

預期遠端已有五份：`20260916085144` … `20260916085221`。  
本地還有 **四份不在遠端 history** 的舊檔：

```text
20260903_address_search_cache.sql
20260906_parking_open_data.sql
20260907_taiwan_poi_stage3.sql
20260907_taiwan_poi_suggest.sql
```

**禁止**為了讓 dry-run 變乾淨而刪檔、repair、或把它們 push 上去。若 dry-run 要把它們當 pending → 依 Task C STOP。

### Task C — Advisor `db push --dry-run`（已授權過 apply，但仍要再過 dry-run）

Jin 已授權：**只套用 Advisor remediation**。仍必須先 dry-run。

```bash
npx supabase db push --dry-run
```

**PASS：** pending **只有** `20260917234436_phase53a_advisor_remediation.sql`。

**STOP（不准 push、不准 repair、不准改 history、不准刪 migration）：** dry-run 還要套用：

- 上述五份已對齊檔名的 schema
- 四份 extra local 檔
- 任何其它 SQL

把完整 proposed list 回報。

### Task D — 僅在 C PASS 後套用 Advisor

```bash
npx supabase db push
npx supabase migration list --linked
```

只允許出現一份新的 `phase53a_advisor_remediation`。

### Task E — 活庫安全驗證（成功執行 SQL ≠ CLOUD SECURITY PASS）

驗證（用 SQL editor 或 linked CLI，**log 禁止含 secret**）：

1. `search_taiwan_pois(text, float8, float8, int)`：SECURITY INVOKER、`search_path=public`、EXECUTE 僅 anon/authenticated。
2. `pois_in_bounds`、`search_taiwan_addresses`、`search_taiwan_pois` 均 INVOKER + 固定 search_path。
3. `spatial_ref_sys` RLS ON；policy `spatial_ref_sys_public_read` 只有 SELECT；anon/authenticated 無 INSERT/UPDATE/DELETE/TRUNCATE。
4. 三個 `st_estimatedextent` overload 不可被 anon/authenticated 當 App API 執行。
5. 重跑 Security Advisor：`spatial_ref_sys` RLS **ERROR 必須消失**。
6. 重複 POI 索引已 drop；**仍須留下** name trigram、geom GiST、`(source, source_id)` unique 各一份。若缺 → STOP，不要擅自建新 index。
7. 列出 Phase 5.3A 相關表的 RLS / policy。
8. 活庫列數：POI、published POI、address、aliases。

`extension_in_public` 可暫留 WARN。  
`rls_enabled_no_policy` 四張內部表可留 INFO。  
unused index 在 0 筆時不要刪。

PASS 後狀態才可改為：

```text
CONDITIONAL PASS
CLOUD SCHEMA APPLIED
CLOUD SECURITY PASS
YUNLIN DRY-RUN PASS
NOT CLOUD PILOT PASS
NOT PRODUCTION READY
```

然後 **STOP**，等雲林寫入授權。

### Task F — 雲林正式寫入（**尚未授權**）

未聽到 Jin 明確 `SOUTH_POI_APPLY=1` 前禁止。

授權後建議：

```bash
# 先再 dry-run
SOUTH_POI_COUNTIES=雲林縣 SOUTH_POI_PUBLISHED_ONLY=1 npm run import:south-pois

# 僅在確認後
SOUTH_POI_APPLY=1 SOUTH_POI_COUNTIES=雲林縣 SOUTH_POI_PUBLISHED_ONLY=1 \
NAVPILOT_SUPABASE_PROJECT_REF=rxzbsthsqlozxgctdoks \
npm run import:south-pois
```

預期 11,515 published。對帳失敗 → STOP。不要一次灌六縣市。

### Task G — 其餘南部縣市 POI（F 通過後，另授權）

嘉義市、嘉義縣、臺南市、高雄市、屏東縣。同樣 `PUBLISHED_ONLY=1` + checkpoint。

### Task H — 門牌雲端（另授權 + 官方檔）

本機 staging 是 NLSC 衍生。未確認官方縣市檔或另一次明確授權前，不寫 `taiwan_address_index`。

### Task I — 實車／Preview 驗收導航

本機：`npm run dev` port `43145`。  
Vercel Preview：對功能分支開 Preview，**不是** Production。  
實車看：羅盤穩定、黃標朝上、3D 大小、2D zoom、建議速度。

### Task J — Production 正式版（**尚未授權給 Codex 自動做**）

Jin 曾說「讓這個變成 production」，但後續閘門仍寫 **禁止 Production / 禁止 merge main**。  
Codex **預設不要** merge `main`、不要 Production deploy。  
要上正式版必須再收到**單獨一句**：例如 `promote branch to GitHub main and Vercel Production`。

目前 Production 仍指向舊 `main` `c57777b` / `nav-map-tjc1.vercel.app`。

---

## 4. 本機 extra migrations（dry-run 地雷）

`supabase/migrations/` 除對齊後的 5+1 Advisor 外還有：

```text
20260903_address_search_cache.sql
20260906_parking_open_data.sql
20260907_taiwan_poi_stage3.sql
20260907_taiwan_poi_suggest.sql
```

它們**不在** NavPilot 遠端那五筆 history。  
`db push --dry-run` 很可能會想套用它們 → **必須 STOP**，回報 list，等 Jin 決定（移出目錄／另開 migration 策略）。**不要自作主張 git rm 或 repair。**

---

## 5. Secret 清單（只放 session／CLI，禁止寫進本檔的值）

```text
SUPABASE_ACCESS_TOKEN
SUPABASE_DB_PASSWORD
SUPABASE_URL=https://rxzbsthsqlozxgctdoks.supabase.co
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NAVPILOT_SUPABASE_PROJECT_REF=rxzbsthsqlozxgctdoks
```

禁止：`NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`。

---

## 6. 建議 Codex 第一回合

1. 確認 `printenv` 有 `SUPABASE_ACCESS_TOKEN`（只印名稱）。  
2. `npx supabase projects list` → 確認 NavPilot ref。  
3. `link --project-ref rxzbsthsqlozxgctdoks`。  
4. `migration list --linked`。  
5. `db push --dry-run`。  
6. **不是**單一 Advisor 檔 → STOP 並貼 proposed list。  
7. 是 → `db push` → Task E 活庫檢查。  
8. **不要** `SOUTH_POI_APPLY`、**不要** merge、**不要** Production。

---

## 7. 關鍵路徑

```text
docs/phase-5-3a-yunlin-dry-run.json
docs/phase-5-3a-south-poi-report.md
docs/phase-5-3a-supabase-upload-status.md
supabase/migrations/20260917234436_phase53a_advisor_remediation.sql
scripts/import-south-pois-supabase.mjs
scripts/supabase-navpilot.mjs
src/lib/heading-cone.ts
src/components/map/driving-map.tsx
src/lib/guidance-arrows.ts
```

---

## 8. 給 Jin 的一句

雲端安全修正卡在 **token 沒進這個 Agent VM**。新 environment + 新 Agent 後從 Task A 重跑。雲林寫入與 Production 仍要各一次明確授權。
