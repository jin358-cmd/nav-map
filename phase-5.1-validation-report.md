# PHASE 5.1 VALIDATION REPORT

驗收時間：2026-09-03  
範圍：Phase 5.1 + **5.1.1 收尾**  
分支：`cursor/feat-phase-5-1-search-oauth-nav-ui-5225`  
對照：`main` / `github/main`（`c57777b`）

本輪**未**改 Google 登入 UI、導航提示卡、路線演算法、GPS、Camera。  
本輪**未 push、未 merge**。驗收檔不納入 commit。

---

## 1. Git 狀態

| 項目 | 值 |
| --- | --- |
| 分支 | `cursor/feat-phase-5-1-search-oauth-nav-ui-5225` |
| HEAD | `5b2620789d06315a5ff2a6b8a2cf54799d415f55` |
| 訊息 | `fix: close Phase 5.1 geocoding validation gaps` |
| working tree（功能碼） | 乾淨 |
| 未追蹤 | `phase-5.1-validation-report.md`、`phase-5.1-review.patch` |
| push GitHub | **否**（`git ls-remote --heads github` 無此分支） |
| push origin | `5b26207` **未 push**（比 `origin/...` 超前 1） |
| merge `main` | **否** |

本分支相對 `main` 的 commits：

```
5b26207 fix: close Phase 5.1 geocoding validation gaps
1d9ad35 fix: run TGOS/NLSC/OSM only after formal search submit
1613e56 feat: Phase 5.1 multi-source search, OAuth states, smaller nav card
```

`git diff main...HEAD`：27 files, +1972 / −556。

---

## 2. 修改檔案（相對 main）

| 檔案 | 功能 | 風險 |
| --- | --- | --- |
| `src/lib/geocoding/*` | 多來源編排、suggest／search、精確度 | 中 |
| `src/hooks/use-address-search.ts` | debounce 只 suggest；submit 才 search | 低 |
| `src/components/overlay/address-search.tsx` | 搜尋鈕、正式查詢列、badge | 低 |
| `src/app/api/geocode/route.ts` | `mode=suggest\|search` | 低 |
| `src/lib/geocoding/providers/google.ts` | 永遠停用 | 低 |
| `src/lib/geocoding/providers/cache.ts` | 快取；濾掉 google | 中 |
| `src/lib/geocoding/providers/nlsc.ts` | 真實 NLSC | 低 |
| `src/lib/geocoding/providers/osm.ts` | 公開 Nominatim＋Photon，僅 search | 中 |
| `src/lib/geocoding/providers/tgos.ts` | 真實 TGOS，無金鑰 disabled | 低 |
| `docs/google-oauth-setup.md` | OAuth ≠ Geocoding | 低 |
| `supabase/migrations/20260903_address_search_cache.sql` | 快取表 | 中：需人工套用 |
| 登入／導航卡／map padding | 5.1 已過；5.1.1 未再改行為 | — |

---

## 3. 地址搜尋

### 公開 Nominatim

- Provider：`src/lib/geocoding/providers/osm.ts`
- Endpoint：**公開** `https://nominatim.openstreetmap.org/search`（另 Photon `https://photon.komoot.io/api/`）
- **不是**自架或商用 Nominatim
- **不得**宣稱公開 Nominatim 支援 autocomplete

| 時機 | 會不會打公開 Nominatim |
| --- | --- |
| 逐字輸入 | **否** |
| 350ms debounce | **否**（只 `mode=suggest`：快取＋本機 POI） |
| Enter／搜尋鈕／「搜尋「…」」／語音定稿 | **是**（`mode=search`，且官方無精確門牌時） |

AbortController：suggest 與 search 分開；query 變更會 abort 舊正式搜尋；generation token 避免舊結果覆蓋。

（長按地圖的 `/api/reverse` 仍可能打 Nominatim reverse，**不是**搜尋 autocomplete。）

### Google Geocoding／Places

- OAuth 登入**未改、按鈕仍在**
- `googlePlacesEnabled()` **永遠 false**
- `createGoogleProvider().enabled === false`，`search()` 回 `[]`
- 編排狀態：`disabled_by_map_renderer_policy`
- 即使有 `GOOGLE_PLACES_API_KEY` 也不呼叫、不畫上 MapLibre
- `writeAddressCache` 過濾 `source === "google"`
- 文件：`docs/google-oauth-setup.md` 第 4 節

### 精確度

```ts
export type AddressAccuracy =
  | "exact-house"
  | "interpolated"
  | "approximate"
  | "lane-center"
  | "road-center"
  | "landmark";
```

| 值 | UI | exactHouseNumber |
| --- | --- | --- |
| exact-house | 精確門牌 | true |
| interpolated | 推估門牌位置 | **false** |
| approximate | 約略位置 | false |
| lane-center | 巷弄位置 | false |
| road-center | 道路位置 | false |
| landmark | 地標位置 | false |

函式：`classifyMatchKind`、`isInterpolationHint`、`ACCURACY_LABELS`、`matchKindLabel`。  
TGOS `matchType` 含「內插」→ interpolated。OSM 即使像門牌也降為 interpolated。

### 逐項標記

| # | 項目 | 判定 |
| --- | --- | --- |
| 快取讀 | PARTIAL PASS（程式有；Supabase 未接） |
| 快取寫 | PARTIAL PASS（同上；google 已排除） |
| migration | CODE READY / MIGRATION NOT APPLIED |
| TGOS | PASS（真實；執行期未設定） |
| NLSC | PASS（真實、已啟用） |
| OSM 僅正式送出 | **PASS** |
| Nominatim 非 autocomplete | **PASS** |
| Google 地理搜尋 | **PASS**（policy 停用） |
| debounce 350ms 只建議 | **PASS** |
| AbortController | **PASS** |
| interpolated | **PASS** |

---

## 4. Google 登入

維持前輪 **PASS**。5.1.1 未改 UI。Client ID 未設定時仍顯示「尚未完成設定」。

---

## 5. 導航提示卡

維持前輪 **PASS**（含 Camera padding）。5.1.1 未改。

---

## 6. 環境變數與安全性

維持 **PASS**。私密 key 無 `NEXT_PUBLIC_`。Service Role 只在 `cache.ts`（`server-only`）。`.env.example` 空值。`.env.local` 未追蹤。

---

## 7. 指令檢查結果

```
lint       PASS（exit 0；既有 warning：use-located-region.ts）
typecheck  PASS
test       NOT AVAILABLE（無 script，exit 1，不視為通過）
build      PASS
git diff --check  PASS
```

---

## 8. UI 驗證

已通過（前輪＋本輪程式／API）：

- Google 未設定 →「尚未完成設定」
- 輸入中只顯示紀錄、快取、本機店家
- Enter／搜尋才查門牌
- 導航卡左上角，直向／橫向可用

---

## 9. 尚未完成或需人工設定

### NLSC（獨立）

| 項目 | 事實 |
| --- | --- |
| 檔案 | `src/lib/geocoding/providers/nlsc.ts`；HTTP：`src/services/official-address.ts` `searchNlscMapHits` |
| Endpoint | 真實 `https://api.nlsc.gov.tw/idc/TextQueryMap/{query}/10/{lng}/{lat}` |
| Placeholder？ | **否** |
| 帳號／Key／白名單 | 公開 TextQueryMap **免金鑰**。`NLSC_API_KEY` 僅在 `.env.example`，程式未讀。 |
| 未設定時 | 仍 **enabled**（公開服務），不是 disabled |
| 失敗隔離 | `runProvider` catch；與 TGOS `allSettled`；不影響 OSM |
| 假資料 | **無** |

### 其他

1. Google OAuth：人工填 `NEXT_PUBLIC_GOOGLE_CLIENT_ID`（`docs/google-oauth-setup.md`）。不要填假 ID。
2. TGOS：`TGOS_APP_ID` + `TGOS_API_KEY`。
3. Supabase：**CODE READY / MIGRATION NOT APPLIED**  
   人工執行：`supabase/migrations/20260903_address_search_cache.sql`  
   再設 `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`。  
   未套用時搜尋仍可用；快取失敗不 500、不洗版。
4. 無 `npm run test`。
5. 等驗收後再決定 push GitHub／merge。

---

## 10. 最終結論

**CONDITIONAL PASS**

### 完成條件答覆

1. 公開 Nominatim **不會**因 debounce 自動呼叫。  
2. Google Geocoding **完全不在** MapLibre 搜尋鏈啟用。  
3. Google 結果 **不可能**寫入共用 Supabase 快取（不執行＋寫入過濾）。  
4. `interpolated` **已獨立實作**。  
5. NLSC **真正可用**（公開 TextQueryMap），不是 placeholder。  
6. Supabase migration **未套用**（CODE READY / MIGRATION NOT APPLIED）。  
7. 新 commit：`5b2620789d06315a5ff2a6b8a2cf54799d415f55`。  
8. `git status`：功能碼乾淨；兩份驗收檔未追蹤；比 origin 超前 1 commit。  
9. **仍未 push `5b26207`、未 push GitHub、未 merge。**

條件：TGOS／Supabase／OAuth 需人工設定；無 test script。

停止，等待人工驗收。
