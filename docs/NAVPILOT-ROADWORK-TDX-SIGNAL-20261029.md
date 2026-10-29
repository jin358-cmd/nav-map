# NavPilot 2026-10-29 驗收報告

Document ID: `NAVPILOT-CURSOR-ROADWORK-TDX-SIGNAL-20261029-001`

查核時間以 Asia/Taipei 記述。本輪沒有合併 `main`，沒有改寫 Production，沒有寫入 Supabase。

## 1. WORKSPACE / REPO / BRANCH / HEAD / DIRTY / PR

- Repo: `jin358-cmd/nav-map`
- Branch: `integration/roadwork-tdx-poi-20261028`
- 執行前 HEAD: `8b1d1c76ba1929fba440ecd3ece8ffa057c0e662`（與文件查核基準一致）
- PR: https://github.com/jin358-cmd/nav-map/pull/3 （Draft，base `fix/TDX-integration`）
- Production URL: https://navpilot.pmos.space/ 本輪只讀。首頁 HTTP 200，Vercel deployment id `dpl_4eiWHnrEM9nxkDRsbPzDkZ61AX4T`。HTML 未露出 git SHA，因此正式站 SHA 仍以文件記載的 `86610920a2d2bb34694f5ce128e6a085acb550c0` 為基準，本輪沒有部署或 Promote。
- Preview alias: https://nav-map-git-integration-roadwork-tdx-poi-20261028-tjc1.vercel.app/ 匿名開啟會被 Vercel SSO 轉到登入頁。更新方式是推上既有整合分支，不另開 Preview。

## 2. SHORTCUT_INTEGRATION

- 右側地圖控制列的第二顆施工鈕已移除。
- 功能選單既有黃色「施工」是唯一入口。徽章分開顯示施工事件數與公告數，例如 `0|11`。
- 浮層分頁為「施工事件」與「官方公告」。既有施工圖層只在施工事件分頁開關。
- 官方公告維持 11 筆、去重後 11 筆、地圖標記 0。缺值顯示「尚未確認」，並寫明不代表道路現在封閉。
- 點其他功能選單、停車、音樂或最愛時關閉施工浮層；再點施工可關閉。

## 3. TDX_EIPP

- 本機 `npm run preflight:tdx` 結果：`BLOCKED_SERVER_NAMES_MISSING`。沒有讀取任何憑證值，也沒有打 Live TDX。exit code 2。
- `npm run test:tdx:env`：5 項通過。`src/` 沒有 `NEXT_PUBLIC_TDX_CLIENT_ID` 或 `NEXT_PUBLIC_TDX_CLIENT_SECRET`。
- 這個工作環境沒有 Vercel token，無法對 Preview／Production 做 `env ls`。文件記載 Vercel 上有公開前綴名稱；那些名稱不能當成可遷移的 Server-only 秘密。Owner 需在 TDX 官方平台輪替後，只對 Preview 建立 `TDX_CLIENT_ID` 與 `TDX_CLIENT_SECRET`。
- `/api/traffic?fresh=1` 現況：`origin=unavailable`、0 路段。畫面顯示「路況資料暫時無法取得」。沒有用示範路況填空。
- TDX-E3／E4／E5：BLOCKED。本文件不授權正式環境變更。

## 4. SIGNAL_SOURCE_MATRIX

| 來源 | 授權 | 覆蓋 | 位置 | 即時秒數 |
|---|---|---|---|---|
| 臺南市公共管線圖資 110年交通號誌 | 政府資料開放授權條款-第1版 | 臺南市，21576 個原始點，聚成 14242 個路口 | 座標符合 EPSG:3857，已轉 WGS84，並落在臺灣範圍。來源 zip 沒有 `.prj`。可信度為 reported，不是現場複核 | 不可用。設備註記含「倒數計時」只代表歷史設備文字 |
| OpenStreetMap `highway=traffic_signals` | ODbL，本輪未匯入 | 備援 | 未使用，因為已有官方位置 | 不是相位資料 |
| TDX | 路況 API，不是號誌秒數 API | 交通部 2026-04-23 說明 TDX 沒有紅綠燈即時剩餘秒數 | 不適用 | BLOCKED |
| 授權 SPaT／MAP | 尚未取得 | UNKNOWN | UNKNOWN | BLOCKED。沒有對政府號誌內網或控制器取資料 |

來源頁：https://data.tainan.gov.tw/DataSet/Detail/db71753a-125c-46e9-95a9-60d35512d4e5

原始 zip SHA-256：`ea71bc8511c4019c56e2256c0b90ca2d2fb397dca352a1e819d9c472d8f603d4`。zip 與 29MB dbf 沒有進 Git。

## 5. SIGNAL_UI

- 縮放 14 以上，視窗內顯示中性灰「--」號誌圖示。導航中只留路線兩側 120 公尺內的點。
- 沒有座標的點不畫。秒數一律 `--`，燈態與方向為「尚未確認」。
- 點擊卡寫明這是 110 年歷史圖資，不是即時燈號，並以現場號誌及員警指揮為準。
- 紅／黃／綠與 10、09、08 秒只存在 `src/lib/traffic-signals/demo.mjs`，由 selftest 以 `allowDemo` 呼叫。公開 API 與駕駛介面不載入它。
- 圖層開關在既有圖例的「路口號誌」，沒有新增第二排快捷鍵。

## 6. TESTS

日期：2026-10-29，Asia/Taipei。工作目錄 `/workspace`。

| 命令 | 結果 |
|---|---|
| `node scripts/traffic-signal-selftest.mjs` | PASS，exit 0。14242 個路口，樣本秒數皆為 null |
| `node scripts/roadwork-selftest.mjs` | PASS，exit 0。官方樣本 11/11/0 地圖點 |
| `npm run test:tdx:env` | PASS，exit 0，5 tests |
| `npm run preflight:tdx` | BLOCKED，exit 2，`BLOCKED_SERVER_NAMES_MISSING` |
| `npm run test:tdx` | PASS，exit 0 |
| `npm run test:address` | PASS，exit 0 |
| `npx tsc --noEmit` | PASS，exit 0 |
| `npx eslint` 於本次改動的主要檔案 | PASS，exit 0 |
| `npx next build` | PASS，exit 0。既有 address index 動態讀檔警告仍在，不是本輪新增失敗 |

沒有實車 GPS 或語音路測，不能宣稱實車驗收。

## 7. DEPLOY

- 唯一 Preview 仍是整合分支 alias。推送該分支後由既有 Vercel 專案更新。沒有另開網站。
- 匿名檢查 Preview 得到登入牆，因此本環境不能讀取新的 Deployment ID。
- Production：未修改。

## 8. OWNER_GATE

1. 在 TDX 官方平台輪替憑證，只對 Preview 設定 Server-only `TDX_CLIENT_ID`、`TDX_CLIENT_SECRET`。不要把舊的 `NEXT_PUBLIC_TDX_*` 值複製過來。完成後才做低頻 token 與路況 probe。
2. 確認公開前綴變數的停用與回退計畫。本輪沒有刪除它們。
3. 若要顯示真的路口秒數，需提供授權 SPaT／MAP、路口與行進方向對應，以及核准的 TTL。在那之前畫面維持 `--`。
4. Production、`main` 合併、Supabase 解除暫停與資料覆寫都尚未授權。
