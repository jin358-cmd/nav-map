# Google OAuth 設定（智駕地圖）

Google 登入使用 **Google Identity Services** 的 OAuth token client（彈出視窗），不是 Google Places Key，也**不需要 Client Secret**。

## 1. 建立 OAuth 2.0 Client ID

1. 開啟 [Google Cloud Console](https://console.cloud.google.com/apis/credentials)。
2. 選取或建立專案。
3. 「API 和服務 → OAuth 同意畫面」：User type 選外部；測試中請把會登入的 Gmail 加到測試使用者。
4. 「API 和服務 → 程式庫」啟用 **Google Drive API** 與 **YouTube Data API v3**。
5. 「憑證 → 建立憑證 → OAuth 用戶端 ID」，應用程式類型選 **Web application**。

## 2. Authorized JavaScript origins

必須**完全相符**（含 `http`／`https`，不要加路徑）：

本機：

- `http://127.0.0.1:43145`
- `http://localhost:43145`

Vercel Preview（依實際網域再加）：

- `https://nav-map-git-feat-phase-5-2-navigation-experience-tjc1.vercel.app`

正式網域：

- `https://你的正式網域`

授權重新導向 URI 可留空（本專案用 GIS 彈出視窗，不走 redirect）。
Google **不接受** `*.vercel.app` 萬用字元，每個 Preview 網域都要單獨加入。

## 3. 環境變數

擇一填入 Web Client ID（形如 `123456789-xxxx.apps.googleusercontent.com`）：

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_ID=
```

- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`：建置時打進前端
- `GOOGLE_CLIENT_ID`：由 `GET /api/auth/google-config` 提供給前端（Client ID 本來就是公開值）

本機改 `.env.local` 後**重新啟動** `npm run dev`。  
Vercel：Project → Settings → Environment Variables，套用 Preview／Production 後**重新部署**。

**不要**把 Client Secret、Places Key 或 Service Role 加 `NEXT_PUBLIC_`。

## 4. Client ID 與 Places Key 的差別

| 變數 | 用途 | 可否放前端 |
| --- | --- | --- |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_ID` | Google 登入、Drive 書籤、YouTube 歌單 | Client ID 可以 |
| `GOOGLE_PLACES_API_KEY` | 地址／地點補查 | **不可以**，只能在 Server |

禁止把 Places Key 當成 OAuth Client ID。

**MapLibre 模式不使用 Google Geocoding／Places。** 登入只負責帳號、Drive 書籤與 YouTube 歌單。

## 5. 未設定時的行為

未填 Client ID 時地圖仍可使用。底部「Google 登入」會顯示無法使用，點擊只會提示「Google 登入尚未完成設定」。
