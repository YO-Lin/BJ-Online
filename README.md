# 多人連線 21 點 (Blackjack)

即時多人連線 21 點練習桌：最多 6 位玩家同房、每人可開多手牌（全房上限 6 手）、電腦自動當莊家、共享 Hi-Lo 流水數/真數、每手可查看基本策略建議、籌碼跨次登入保存。

規則：6 副牌連續靴、莊家軟17停牌 (S17)、分牌後可加倍 (DAS)、不可投降、莊家 Peek、保險 2:1、Blackjack 賠 3:2、最多分牌3次（4手）、分A後每手只發1張牌。

## 專案結構

```
/client   React + Vite 前端
/server   Node.js + Express + Socket.io 後端
```

## 本機開發

需要一個 Postgres 資料庫（本機安裝或雲端皆可）。

```bash
# 1. 安裝套件
npm run install:all

# 2. 設定環境變數
cp server/.env.example server/.env
# 編輯 server/.env，填入 DATABASE_URL

# 3. 建立資料表
npm run migrate

# 4. 開發模式（兩個終端機分別執行）
npm run dev:server   # http://localhost:3000
npm run dev:client   # http://localhost:5173，會自動 proxy API/WebSocket 到 3000
```

開發時直接開瀏覽器到 `http://localhost:5173`，多開幾個分頁/無痕視窗，用不同暱稱註冊即可測試多人連線。

## 部署到 Zeabur

1. 在 Zeabur 建立一個新專案，新增一個 **Postgres** 服務（Zeabur 會自動產生 `DATABASE_URL` 並注入到同專案內的其他服務）。
2. 新增一個 **Git/程式碼 服務**，指向這個 repo。
   - Build Command：`npm run build`
   - Start Command：`npm start`
3. 在服務的環境變數加上 `JWT_SECRET`（任意隨機字串，用來簽發登入token）。`DATABASE_URL` 與 `PORT` 由 Zeabur 自動提供。
4. 部署完成後，連線一次執行 migration（可在 Zeabur 的服務終端機執行 `npm run migrate`，或本機用該服務的 `DATABASE_URL` 執行一次）。
5. 開啟服務網址即可使用；分享房號給朋友，大家各自註冊帳號即可加入同一桌。

因為房間/牌局狀態存在單一 process 的記憶體中，**請勿開多個 instance**（不要開自動擴展），否則不同 instance 之間看不到彼此的房間。

## 已知限制 / 之後可擴充

- 牌局歷史紀錄只存在記憶體，重啟後會消失（帳號籌碼不受影響，因為存在資料庫）
- 若要水平擴展多個 instance，需要另外導入 Redis 之類的共享狀態
