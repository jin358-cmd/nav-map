# Phase 4 Disasters — NCDR 即時示警

Smart Road Taiwan 已接上國家災害防救科技中心（NCDR）民生示警公開資料，並保留 mock fallback。沒有重做 CCTV、TDX 路況、地址搜尋或 OSRM 路線。

公開 JSON feed 不需金鑰。未設定 `NCDR_API_KEY`、會員 feed 失敗、或公開 feed 逾時／非 JSON 時，地圖與 HUD 走臺南示意災害標記。

## Phase 4 做了什麼

- 資料鏈：NCDR live（公開 JSONAtomFeed，或會員 webapi）→ **MOCK**。
- 密鑰只在伺服器：`GET /api/disasters` 可選讀 `NCDR_API_KEY`。不可用 `NEXT_PUBLIC_`。
- 來源標籤：`NCDR 即時災害` / `示範災害`。HUD 顯示 `CCTV {origin} · 路況 {origin} · 災害 {origin}`。
- 只畫駕駛相關示警：積水／封路／地震／颱風與強風。停水、高溫、系統測試等略過。
- 範圍：影響臺南市的示警（內文、發布單位或行政區）。
- 已過期、`Cancel`、`System` 不進地圖。同類型＋同區域只留最新一則，最多 24 點。
- 更新：live cache 與前端輪詢約 **60 秒**；拖曳／縮放不重打 NCDR。手動「重新整理情報」會強制刷新。
- 座標：feed 無幾何時，用臺南區公所附近質心；全市強風放沿海。

成功抓到 feed 但臺南目前沒有駕駛相關示警時，會顯示空的 live 結果，不會假裝成 mock 積水。

## NCDR 端點

| 用途 | URL |
| --- | --- |
| 公開 JSON（免金鑰） | `GET https://alerts.ncdr.nat.gov.tw/JSONAtomFeed.ashx` |
| 會員 JSON（選填） | `GET https://alerts.ncdr.nat.gov.tw/webapi/JsonAtomFeed.ashx?apikey=` |

逾時 12 秒。會員 feed 失敗會回落公開 feed。

## 種類對應

| NCDR 類別 | 地圖 |
| --- | --- |
| 淹水、淹水感測、交流道下地方連絡道淹水、河川高水位、區排警戒、水庫放流、降雨、雷雨 | flood |
| 道路封閉、土石流及大規模崩塌、疏散避難 | closure |
| 地震 | quake |
| 颱風、強風 | typhoon |

紅色／一級／無法通行 → warning；黃色燈號／注意 → watch。

## 檔案

| 路徑 | 角色 |
| --- | --- |
| `src/services/ncdr-client.ts` | 公開／會員 feed |
| `src/services/disaster-api.ts` | live → mock、60 秒 cache |
| `src/app/api/disasters/route.ts` | 瀏覽器入口 |
| `src/lib/disaster-normalize.ts` | JSON 解析、臺南過濾、去重 |
| `src/lib/tainan-districts.ts` | 行政區質心 |
| `src/hooks/use-disaster-view.ts` | 輪詢與 fallback |
| `src/data/mock-disasters.ts` | 無 feed 或 live 失敗 |
