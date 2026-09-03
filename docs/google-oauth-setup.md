# Google OAuth 設定（NavPilot）

Google 登入使用 **Google Identity Services** 的 OAuth token client，不是 Google Places Key。  
Cursor 不會幫你產生 Client ID，下列步驟需由專案負責人在 Google Cloud 完成。

## 1. 建立 OAuth 2.0 Client ID

1. 開啟 [Google Cloud Console](https://console.cloud.google.com/)。
2. 選取或建立專案。
3. 啟用 **Google Drive API** 與 **YouTube Data API v3**（書籤與歌單）。
4. 到「API 和服務 → 憑證 → 建立憑證 → OAuth 用戶端 ID」。
5. Application type 選 **Web application**。

## 2. Authorized JavaScript origins

在 OAuth 用戶端加入實際會開啟 NavPilot 的來源，**不要**把 Places API Key 填在這裡。

本機範例：

- `http://127.0.0.1:43145`
- `http://localhost:43145`

Vercel Preview 原則：

- 加入該專案的 Preview 網域，例如 `https://<project>-git-<branch>-<team>.vercel.app`
- 若使用固定 Preview 網域，也一併加入

正式網域原則：

- 只加入正式 HTTPS 網域，例如 `https://your-domain.com`
- 修改 origins 後通常立刻生效，但瀏覽器快取的舊 token 可能要重新登入

授權重新導向 URI 可留空（本專案使用 GIS token client 彈出視窗，不走 redirect）。

## 3. 環境變數

本機 `.env.local`：

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
```

填入 Web application 的 Client ID，然後**重新啟動** `npm run dev`。

Vercel：

1. Project → Settings → Environment Variables
2. 新增 `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
3. 分別套用到 Preview 與 Production
4. **重新部署**後才會生效

## 4. Client ID 與 Places Key 的差別

| 變數 | 用途 | 可否放前端 |
| --- | --- | --- |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google 登入（OAuth） | 可以 |
| `GOOGLE_PLACES_API_KEY` | 地址／地點補查 | **不可以**，只能在 Server |

禁止把 Places Key 當成 OAuth Client ID。  
禁止把 `GOOGLE_PLACES_API_KEY` 設成 `NEXT_PUBLIC_`。

**MapLibre 模式不使用 Google Geocoding／Places。**
`NEXT_PUBLIC_GOOGLE_CLIENT_ID` 只負責登入、Drive 書籤與 YouTube 歌單。即使設定了 `GOOGLE_PLACES_API_KEY`，地圖搜尋鏈仍標為 `disabled_by_map_renderer_policy`，不會把 Google 地理結果畫上 MapLibre，也不會寫入共用地址快取。未來僅在採用合規呈現方案後重新評估。

## 5. 未設定時的行為

未填 Client ID 時地圖仍可使用。底部「Google 登入」會顯示無法使用，點擊只會提示「Google 登入尚未完成設定」，不會出現 `.env.local` 或變數名稱。
