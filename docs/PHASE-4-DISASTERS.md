# Phase 4 — NCDR 即時災害資訊

- 來源：NCDR 民生示警 `JSONAtomFeed.ashx` 與各示警 CAP 文件。
- 範圍：只保留摘要或 CAP `areaDesc` 涵蓋臺南市的有效示警。
- 定位：使用 CAP `polygon`／`circle` 的幾何中心；無座標示警不臆測位置。
- 顯示：MapLibre `disaster-source`、circle layer 與透明 hit layer，不使用 DOM 災害 Marker。點擊開啟 `DisasterDetailCard`。
- 更新：server cache 與瀏覽器輪詢均為 **120 秒**。
- fallback：官方 feed 請求或解析失敗才顯示 mock；live 成功但臺南 0 則時維持 0 則。
- 效能：先用 feed 標題／摘要／發布單位預篩臺南，再最多抓 **24** 份 CAP，避免對整份 Atom（約 1500 則）並行下載。

可選伺服器端環境變數：`NCDR_ALERT_FEED_URL`（空白則用官方 JSON Atom）。`NCDR_API_KEY` 仍保留給會員 webapi 路徑。

## 種類

積水、封路、地震、颱風、豪雨、強風、崩塌、其他。嚴重度：注意／警戒／緊急。

## 檔案

| 路徑 | 角色 |
| --- | --- |
| `src/services/disasters.ts` | NCDR JSON Atom + CAP 正規化、120 秒 cache、mock fallback |
| `src/app/api/disasters/route.ts` | 瀏覽器入口 |
| `src/lib/disaster-layer.ts` | MapLibre GeoJSON 圖層與點擊 |
| `src/components/overlay/disaster-detail-card.tsx` | 底部詳情卡 |
| `src/hooks/use-disaster-view.ts` | 輪詢與 fallback |
| `src/data/mock-disasters.ts` | feed 失敗時的臺南示意標記 |
