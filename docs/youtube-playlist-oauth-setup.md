# YouTube／YouTube Music 播放清單 OAuth 設定

NavPilot 延用 Phase 5.1 的 **Google Identity Services** token client，不另外做第二套登入。
Google 帳號登入（書籤）與 YouTube 播放清單授權是**分開的 scope**。
禁止把 Client Secret、Places Key 或 Service Role Key 放到前端。

## 1. Google Cloud OAuth

1. 開啟 [Google Cloud Console](https://console.cloud.google.com/)。
2. 選取或建立專案。
3. 「API 和服務 → 程式庫」啟用：
   - **YouTube Data API v3**（歌單）
   - **Google Drive API**（書籤 appData）
4. 「API 和服務 → 憑證 → 建立憑證 → OAuth 用戶端 ID」。
5. Application type 選 **Web application**。
6. 只把 **Client ID** 填進 `NEXT_PUBLIC_GOOGLE_CLIENT_ID`。
   **Client Secret 不得出現在前端、不得加 `NEXT_PUBLIC_`。**

## 2. Authorized JavaScript Origins

GIS 彈出視窗會檢查目前頁面 origin。不符會出現 `origin_mismatch`。

本機：

- `http://127.0.0.1:43145`
- `http://localhost:43145`

Preview：

- `https://<project>-git-<branch>-<team>.vercel.app`
- 若有固定 Preview 網域也要加入

Production：

- 正式 HTTPS 網域，例如 `https://your-domain.com`

授權重新導向 URI 可留空（本專案使用 popup token client，不走 redirect）。
不要在 iframe 或嵌入播放器裡做 Google 登入。

## 3. 所需 scope

| 用途 | Scope | 何時要求 |
| --- | --- | --- |
| Google 登入＋Drive 書籤 | `openid email profile` + `https://www.googleapis.com/auth/drive.appdata` | 點底部「Google 登入」 |
| YouTube 播放清單唯讀 | `https://www.googleapis.com/auth/youtube.readonly` | 第一次同步歌單，或權限不足／過期時 |

已登入且 session 仍有效、且已有 YouTube scope 時，會重用現有權杖。
第一次使用或權限不足時，必須完成 Google 同意畫面，不得略過。

YouTube Data API **不能**提供私人 YouTube Music 曲庫或付費音樂中繼資料。
App 只會列出 API 回傳的可讀取播放清單。

## 4. Vercel 環境變數

| 變數 | 環境 | 說明 |
| --- | --- | --- |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Preview、Production | Web OAuth Client ID |
| `GOOGLE_PLACES_API_KEY` | 不要設 `NEXT_PUBLIC_` | 與登入無關，MapLibre 模式不會用來畫地圖 |

設定後必須**重新部署**。本機改 `.env.local` 後要重開 `npm run dev`。

## 5. 首次授權與後續登入

1. 使用者先完成 Google 登入（書籤）。此時**還沒有** YouTube 權限。
2. 開啟 YouTube 小窗後點「授權 YouTube 播放清單」。
3. Google 同意畫面出現 YouTube 唯讀權限。
4. 成功後 sessionStorage 暫存短效 Access Token（分頁關閉即失效，不寫入 localStorage）。
5. Token 過期會顯示「授權已過期，請重新授權」，不會默默沿用失效權杖。

## 6. 畫面狀態

| 狀態 | 意義 |
| --- | --- |
| 尚未設定 | 沒有 Client ID |
| 尚未授權 | 已登入 Google，尚未給 YouTube scope |
| 載入中 | 正在呼叫 YouTube Data API |
| 已連線 | 已取得可讀取播放清單 |
| 權限不足 | 403／scope 不夠 |
| API 未啟用 | 專案沒開 YouTube Data API v3 |
| 登入失敗 | 使用者取消、popup 被擋、或 origin 不符 |

地圖功能不依賴 YouTube。登入失敗不得影響導航或圖層。

## 7. 常見錯誤

| 現象 | 原因 | 處理 |
| --- | --- | --- |
| `origin_mismatch` | Authorized Origins 沒有目前網域 | 補上本機／Preview／正式 origin |
| popup blocked | 瀏覽器擋彈出視窗 | 允許此站點彈出視窗後重試 |
| access denied | 使用者按拒絕 | 顯示已取消，可再授權 |
| token expired | Access Token 過期 | 顯示重新授權 |
| API not enabled / `accessNotConfigured` | 未啟用 YouTube Data API v3 | 在 Google Cloud 啟用後等數分鐘 |
| 已登入但沒歌單 | 只完成 Google 登入 | 再走一次 YouTube 授權 |
| 只有示範電台 | 尚未授權或 API 失敗 | 小窗仍可用公開電台，不假裝私人曲庫 |

## 8. 本機檢查清單

1. `.env.local` 有 `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
2. Google Cloud 已啟用 YouTube Data API v3
3. Origins 含 `http://127.0.0.1:43145`
4. 用一般視窗（非 iframe）開啟 App
5. 先 Google 登入，再授權 YouTube
6. 不要把 Client Secret 貼進任何 `NEXT_PUBLIC_` 變數
