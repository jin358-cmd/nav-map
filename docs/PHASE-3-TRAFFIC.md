# Phase 3 Traffic — TDX 即時路況

智駕NavPilot 已接上 MOTC TDX 臺南市區即時路況，並保留 mock fallback。沒有重做 CCTV、地址搜尋或 OSRM 路線。

未設定 `TDX_CLIENT_ID` / `TDX_CLIENT_SECRET`（或 live 失敗）時，地圖與 HUD 走臺南示意路段。

## Phase 3 做了什麼

- 資料鏈：TDX live（有憑證且三支 API 都成功）→ **MOCK**。沒有 weather 路況 snapshot。
- 密鑰只在伺服器：`GET /api/traffic` 讀 `TDX_CLIENT_ID` / `TDX_CLIENT_SECRET`。不可用 `NEXT_PUBLIC_`。
- 來源標籤：`TDX 即時路況` / `示範路況`。HUD 顯示 `CCTV {origin} · 路況 {origin}`。
- 獨立圖層：`traffic-source` / `traffic-layer`。舊的 `mock-traffic` 會在 upsert 時清掉。
- 圖層順序（下→上）：底圖 → 路況線 → CCTV → 青綠路線 → HTML 車輛／事故／災害。
- 不一次畫全市：附近 8 km、沿線 400 m、壅塞／阻塞優先，zoom cap 約 16／24／32／40。
- 更新：live cache 60 秒、形狀 cache 15 分鐘、手動「重新整理情報」、60 秒輪詢。拖曳／縮放不重打 TDX。
- HUD：沿線優先，再取最近的車多／壅塞／阻塞；6 km 外的交流道不會壓過前方路段。
- 型別：`TrafficSourceType = "city" | "freeway"`。本階段只抓臺南 **city** live。

## TDX 端點（臺南市區）

Base：`https://tdx.transportdata.tw/api/basic`  
Token：`POST https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token`

| 用途 | Path |
| --- | --- |
| 即時路況 | `GET /v2/Road/Traffic/Live/City/Tainan` → `LiveTraffics` |
| 路段名稱 | `GET /v2/Road/Traffic/Section/City/Tainan` → `Sections` |
| 線型 WKT | `GET /v2/Road/Traffic/SectionShape/City/Tainan` → `SectionShapes` |

三支都帶 `$format=JSON` 與 `$top=3000`（TDX 預設 `$top=30`）。

Join key：`SectionID`。沒有 WKT、少於兩個點、或壅塞級別未知且時速無效的路段會略過。

## 壅塞對應

官方 `LevelItem`：

| 值 | 意義 | 地圖 |
| --- | --- | --- |
| -1 | 道路封閉 | blocked |
| 0 / -99 | 未知／異常 | 用時速推，推不出就略過 |
| 1 | 順暢 | smooth |
| 2 | 車多 | slow |
| 3 | 壅塞 | congested |
| 4 | 嚴重壅塞 | severe |
| 5 / -1 | 極度壅塞／封閉 | blocked |

中文名稱（順暢、車多、壅塞、嚴重壅塞、阻塞、封閉）也會對上。時速：≥40 順暢、≥25 車多、≥10 壅塞、≥5 嚴重壅塞、更低接近停止。

顏色：順暢綠、車多黃、壅塞橘、嚴重壅塞紅、接近停止深紅。

## 預留、本階段不做

- Freeway live / section / shape（`/v2/Road/Traffic/*/Freeway`）— 型別已留 `freeway`。
- 依路況改線、避開壅塞。
- 重做 CCTV 圖層或 Leaflet UI。
- 把全市路段一次鋪上地圖。

## 檔案

| 路徑 | 角色 |
| --- | --- |
| `src/services/tdx-client.ts` | token cache、TDX GET |
| `src/services/traffic.ts` | live → mock、雙層 cache |
| `src/app/api/traffic/route.ts` | 瀏覽器入口 |
| `src/lib/traffic-normalize.ts` | unwrap / 壅塞對應 / join |
| `src/lib/traffic-wkt.ts` | LINESTRING / MULTILINESTRING |
| `src/lib/traffic-query.ts` | 距離、沿線、zoom cap |
| `src/hooks/use-traffic-view.ts` | 節流與過濾 |
| `src/data/mock-traffic.ts` | 無憑證或 live 失敗 |
