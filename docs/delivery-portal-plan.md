# 外送 Portal / Gateway 計畫

狀態：骨架已可下單與派單。付款略過（金額固定 0）。完整點餐介面之後再議。本文件描述已實作的契約，以及明確不做的範圍。

搜尋結果：程式庫裡沒有既有的外送、外送員或配送模組。功能選單、Google 登入與伺服器端 Supabase REST 客戶端是可以沿用的部分。

## 架構

```
NavPilot 客戶端 / 外送員頁
        │  只呼叫自己的 gateway（/api/delivery/*）
        ▼
src/lib/delivery/client.ts
        │
        ▼
Route handlers（src/app/api/delivery/**）
        │  功能旗標、身份、錯誤訊息
        ▼
DeliveryGateway
        │
        ▼
DeliveryProvider
        ├─ SupabaseDeliveryProvider   ← 預設，NavPilot 專案 rxzbsthsqlozxgctdoks
        └─ MemoryDeliveryProvider     ← 單元測試，以及單一行程的本機示範
```

`DeliveryProvider` 是唯一後端邊界。方法：

- `listStores` / `getMenu`
- `createOrder` / `getOrderForCustomer` / `cancelOrder`
- `updateCustomerLocation`
- `setCourierPresence` / `listCourierWork`
- `acceptOrder` / `declineOrder` / `markPickedUp` / `markDelivered`
- `advanceDispatch`（每次讀狀態時推進逾時與下一順位）

之後若要換成真的外送平台，新增一個 provider，不要讓瀏覽器直接打那個平台。

客戶端不准持有 service role，也不讀 Supabase 資料表。位置更新走伺服器路由，每 3 秒輪詢。沒有把這些表加入 `supabase_realtime`：anon 金鑰在 RLS 下讀不到別人的位置，而 service role 不能放進瀏覽器。等顧客與外送員都有 Supabase Auth 之後，再改成 Realtime。

## 訂單狀態機

`created` → `awaiting_dispatch` → `assigned` → `picked_up` → `delivered`

`created`、`awaiting_dispatch`、`assigned` 可以進 `cancelled`。取餐之後不能取消。`delivered` 與 `cancelled` 是終態。

下單成功時會寫兩筆事件（`created`、`awaiting_dispatch`），回傳的訂單狀態已是 `awaiting_dispatch`，因為派單立刻開始。金額欄位固定 `amountCents = 0`，`paymentStatus = "skipped"`。沒有付款步驟。

## 派單

模式是 `nearest` 或 `grab`。預設看環境變數 `DELIVERY_DISPATCH_MODE`（未設定就是 `nearest`）。單筆訂單可以在下單時覆寫。

### 最近外送員（nearest）

1. 以取餐點為圓心，半徑 `DELIVERY_ZONE_RADIUS_METERS`（預設 5000）。實際距離超出這個圓的人不會進名單。
2. 候選人必須上線、位置未過期、沒有進行中的訂單、沒有別筆未過期的指派，而且不在這筆訂單的婉拒名單。
3. 排名先看加權距離。完成送達少於 `DELIVERY_NEW_COURIER_THRESHOLD`（預設 10）次的外送員，排名距離會減少，最多 `DELIVERY_NEW_COURIER_BONUS_METERS`（預設 800 公尺）。0 次拿滿額，滿 10 次歸零，中間按比例。所以新外送員可以比稍遠一點的熟手優先，但遠超過這段優惠的人不會贏過近的熟手。
4. 加權距離差距在 `DELIVERY_DISTANCE_TIE_METERS`（預設 25 公尺）以內視為平手，評分高的優先。沒有任何評價的人不會被當成低分，評分不把他和別人分開。
5. 距離和評分都分不出唯一一位時，這筆訂單改成搶單，先接受者得標。
6. 有唯一一位時寫入 `offered_courier_id` 與 `offer_expires_at`。逾時預設 45 秒。逾時或婉拒就改派下一位；下一位如果又是平手，同樣改搶單。
7. 範圍內沒有人時，訂單留在 `awaiting_dispatch`。

OSRM 車程之後再換。現在的距離不是路網時間。

送達後，這筆訂單的顧客可以給 1 到 5 顆星和最多 80 字的短評，一筆訂單只能評一次。平均與則數由 `delivery_courier_ratings` 即時算出，不改既有的外送員表。

同一位外送員同時只能有一筆進行中的訂單，也只能有一筆未過期的指派。資料庫用部分唯一索引擋住並發。

### 搶單（grab）

訂單維持 `awaiting_dispatch`，不預先指定外送員。所有上線且在 `DELIVERY_GRAB_RADIUS_METERS`（預設 3000）內的外送員看得到。第一個接受的人獲勝。

原子條件是單一筆更新：

`status = awaiting_dispatch AND dispatch_mode = grab AND courier_id IS NULL`

沒有更新到列就是輸。進行中的訂單另有部分唯一索引，第二筆會被拒絕。

忙線中的外送員仍看得到範圍內的搶單，但接受會被拒。這樣才不會一個人同時送兩筆。

Serverless 沒有背景排程。顧客輪詢訂單、外送員輪詢工作清單時都會呼叫 `advanceDispatch`，逾時改派發生在這些請求裡。

## 持久化

新表（只新增，不改既有表、RLS 或函式）：

| 表 | 用途 |
| --- | --- |
| `delivery_stores` | 店家 |
| `delivery_menu_items` | 菜單 |
| `delivery_orders` | 訂單 |
| `delivery_order_events` | 狀態事件 |
| `delivery_couriers` | 外送員上線狀態 |
| `delivery_courier_locations` | 外送員即時位置 |

SQL 在 `supabase/migrations/20261030133000_delivery_portal.sql`。**不要在這個分支套用。** 擁有者審過再套到 NavPilot（`rxzbsthsqlozxgctdoks`）。Gateway 若發現表不存在，回 `schema_missing`，畫面顯示清楚的中文說明，不假裝下單成功。

寫入只走伺服器上的 `SUPABASE_SERVICE_ROLE_KEY`。URL 必須是 `rxzbsthsqlozxgctdoks.supabase.co`，否則拒絕連線。沒有新增密鑰，也沒有 `NEXT_PUBLIC_` 的 service role。

`DELIVERY_PROVIDER=memory` 只給單元測試與單一 Node 行程的本機示範。正式與 Preview 不要設。記憶體狀態跨 serverless 實例不會共享。

## 身份

NavPilot 現有的是瀏覽器 Google 登入（`sessionStorage` + `/api/auth/google-config`），不是 Supabase Auth。

- 顧客若帶通過驗證的 Google ID token，訂單歸 `sub`。
- 沒有登入時，用這台裝置的 `localStorage` 代號（顧客與外送員各一組）。
- 外送員目前沒有對應到 Google 帳號。

缺口：裝置代號沒有密碼，知道代號的人可以冒充。RLS 以 `auth.uid()` 為準，所以 anon 金鑰讀不到訂單與位置；今天的 App 請求是 service role 在伺服器過濾。等 Supabase Auth 的使用者 id 等於 `customer_id` / `courier_id`，同一套 RLS 就會套到 Data API。

## 功能旗標

`DELIVERY_PORTAL_ENABLED`：

- `1` / `true` 開，`0` / `false` 關。
- 沒設定時，`VERCEL_ENV` 為 `preview` 或 `development`，或 `NODE_ENV !== production`，預設開。
- 正式環境預設關。

關閉時功能選單不顯示「外送」，API 回 404。

## 介面

- 功能選單第三列加一顆「外送」，樣式跟其他鍵相同。前兩列仍是登入、CCTV、最愛、音樂，以及災害、施工、事故、停車。
- 點下去開底部／側邊的最小面板：選店、選餐、下單、看狀態。外送員與送達點畫在既有地圖上。
- `/courier` 是外送員頁：上線、分享 GPS、接單、取餐、送達，地圖上看到顧客與送達點。沒有 GPS 時可改用臺南示範座標，按鈕上有寫。

## 明確不做

- 付款、發票、退款、非 0 金額。
- 套用 migration、改既有表、動 GVG／租屋雷達。
- 正式環境部署。
- 改 TDX、路況、停車、OSRM、POI 與既有 API。
- OSRM ETA、Supabase Realtime、外送員評分、完整點餐視覺。
- 新的付費服務或新的密鑰。
