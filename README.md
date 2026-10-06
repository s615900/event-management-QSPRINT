# Event Management — QSPRINT 田徑賽事拍攝登記（Next.js 版）

由 `Hui-Yuan-Sai-Shi-Bao-Ming-Biao-Dan`（Replit：Express API + 靜態 HTML 前台 + Vite React 後台）轉成單一 Next.js 專案。
資料庫仍是 **Ragic**，欄位 ID、表單路徑與原專案完全相同。

- Next.js 16（App Router）、React 19、TypeScript
- Tailwind CSS v4：前台頁面；後台沿用原 admin-web 的 CSS 檔（外觀不變）
- LINE LIFF（`@line/liff`）、LINE Messaging API、Google OAuth（後台）

## 開始使用

```bash
cp .env.example .env.local   # 填入 Ragic、LINE、Google 的金鑰（原本放在 Replit Secrets）
npm install
npm run dev                  # http://localhost:3000
```

LIFF 診斷：`/?debug=1`。

### 本機測試模式（不用 LINE、不用 Ragic 金鑰）

`.env.local` 設 `AUTH_TEST_MODE=1` 與 `NEXT_PUBLIC_LINE_TEST_MODE=1`：
- 前台在 localhost 自動以「測試選手」登入，不經過 LINE
- 後台登入頁出現「本機測試登入」按鈕，不經過 Google
- `RAGIC_API_KEY` 空白時改用本機假資料 `data/ragic-fake.json`（預設兩場測試賽事、五所學校）；填了金鑰就自動改連正式 Ragic
- 想從頭測：刪掉 `data/` 資料夾再重新整理

正式環境（`NODE_ENV=production`）這些全部自動關閉。

## 網址對照

| 原本 | 現在 | 說明 |
| --- | --- | --- |
| `/index.html` | `/` | LIFF 初始化、查會員後導向 |
| `/register.html` | `/register` | 選手資料登錄（只需一次） |
| `/form.html` | `/form` | 賽事拍攝登記 |
| `/success.html` | `/success` | 報名成功 |
| `/history.html` | `/history` | 拍攝紀錄 |
| `/album.html` | `/album` | 賽事相簿 |
| `/admin/`（React SPA） | `/admin`、`/admin/weekly-events`、`/admin/members`、`/admin/registrations`、`/admin/event-master`、`/admin/albums` | 後台 |
| — | `/admin/photographers` | 攝影師管理（新功能） |
| — | `/admin/admins` | 管理員權限（新功能） |
| `/admin/login.html` | `/admin/login` | 後台 Google 登入 |
| `/webhook` | `/webhook` | LINE webhook（「解除綁定」） |
| `/api/*`、`/admin/api/*`、`/admin/auth/*` | 同左 | API 路徑不變 |

舊的 `.html` 網址會自動轉到新網址（`next.config.ts`），LINE 選單或書籤不用馬上改。

## 目錄結構

```
src/app/(line)/          前台頁面（LINE LIFF）
src/app/api/             前台 API（Route Handlers）
src/app/webhook/         LINE webhook
src/app/admin/           後台：login / no-access / auth（Google 登入）/ api
src/app/admin/(protected)/  需登入的後台頁面（layout 檢查登入）、原樣式檔在 styles/
src/components/          前台共用元件（藍色頁首、表單 UI）
src/lib/                 前台工具（LIFF、localStorage 快取）
src/server/              只在伺服器執行：ragic.ts（連線＋欄位 ID）、line.ts、dates.ts、admin/*
public/admin/            後台 PWA：manifest、service worker、圖示
```

## 攝影師挑選（參考 studio-nextjs 人員管理）

- 後台「攝影師管理」：新增／編輯人員（名稱、職務、電話、備註）、停用／恢復；已被選手選過的人員不能刪除，只能停用。
- 選手在 LINE 報名頁的「攝影師」欄位挑選；只列出**在職**且職務為**攝影師**的人，也可選「不指定」。名單是空的時這個欄位不會出現。
- 選擇結果會顯示在：報名成功頁、選手的拍攝紀錄、LINE 推播、後台「賽事報名資料」的攝影師欄。
- **目前存在本機 `data/photographers.json`**（Ragic 沒有攝影師表單）。部署到 Vercel 前要改存 Ragic 或資料庫，只需改 `src/server/photographers.ts`。

## 管理員權限

- 後台「管理員權限」頁：新增、編輯、停用可以登入後台的 Google 帳號，直接寫入 Ragic「後台網站管理員清單」（`new-test-parameters/6`；舊路徑 `/4` 會轉址過來，寫入不能走轉址所以改用 `/6`）。
- 防呆：不能停用或改掉自己正在登入的帳號；至少要保留一位啟用中的管理員。
- 攝影師管理裡打開「後台權限」並填 Google Email 的在職人員，也能登入後台，但**只能看「儀表板」和「我的拍攝行程」**（被選手選的場次）；其他頁面會被導回儀表板、其他 API 回 403，儀表板也不顯示選手電話。
- 攝影師帳號每次操作都會重新確認權限，停用或拿掉後台權限後立刻失效。
- 停用 Ragic 管理員帳號後，對方已經登入的狀態最多還會維持 7 天（登入 cookie 的有效期，原版也是如此）。

## 與原版的差異

- 原本三份重複的 Ragic 連線程式合併成 `src/server/ragic.ts`，欄位 ID 都集中在那裡。
- 報名成功推播、大頭照上傳、webhook 處理改用 Next.js `after()`：回應送出後才執行，部署到 Vercel 也不會被中斷。
- 移除原本的暫時除錯 log（IG 欄位 Unicode、LIFF_CHANNEL_ID 長度等）；IG 欄位的三種讀法保留。
- 不再需要 CORS 白名單與靜態檔白名單（Next.js 不會公開原始碼）。
- LIFF ID 可用 `NEXT_PUBLIC_LIFF_ID` 覆寫，未設定時沿用 `2010405599-yknWwXWq`。

## 部署到 Vercel（目前使用）

- GitHub `main` 有新的 commit，Vercel 會自動重新部署。
- `vercel.json` 把伺服器放在東京（hnd1），離 Ragic 與台灣使用者較近。
- 環境變數在 Vercel 專案 Settings → Environment Variables（與 `.env.example` 同名，記得勾 Production）。**不要**設 `AUTH_TEST_MODE`、`NEXT_PUBLIC_LINE_TEST_MODE`。

## 部署到 Replit（舊方式，已改用 Vercel）

`.replit` 已設定好：按 Run 是開發模式（port 5000），Deploy 會 `npm ci && npm run build` 後 `next start`。
金鑰放在 Replit 的 Secrets（與 `.env.example` 同名）。**不要**在 Replit 設 `AUTH_TEST_MODE`、`NEXT_PUBLIC_LINE_TEST_MODE`。

⚠️ Replit 部署環境的檔案在重新部署／重啟後不會保留，`data/photographers.json`（攝影師名單與選手的選擇）會消失，正式使用前要改存 Ragic。

## 上線（例如 Vercel）後要改的外部設定

1. **LINE Developers → LIFF → Endpoint URL**：改成新網域（例：`https://新網域/`）。
2. **LINE Developers → Messaging API → Webhook URL**：`https://新網域/webhook`。
3. **Google Cloud → OAuth 用戶端 → 已授權的重新導向 URI**：加入 `https://新網域/admin/auth/callback`，並把同一個網址填進 `GOOGLE_OAUTH_REDIRECT_URI`。
4. 環境變數記得勾選 **Production**，存檔後要重新部署才會生效。
