# 🎯 Sceut Admin - 訂單與訂閱者管理系統

基於 Next.js 14 和 Supabase 建構的完整管理後台系統，提供訂單管理和訂閱者管理功能。

## 📋 目錄

- [功能特色](#功能特色)
- [技術棧](#技術棧)
- [環境需求](#環境需求)
- [快速開始](#快速開始)
- [環境變數設置](#環境變數設置)
- [數據庫設置](#數據庫設置)
- [功能使用教學](#功能使用教學)
- [API 路由說明](#api-路由說明)
- [專案結構](#專案結構)
- [開發指南](#開發指南)
- [疑難排解](#疑難排解)

---

## 🌟 功能特色

### 訂單管理
- 📊 **訂單統計儀表板** - 即時顯示各狀態訂單數量
- 🔍 **智能搜尋** - 支援訂單編號、客戶姓名、郵箱搜尋
- 🎯 **狀態過濾** - 按訂單狀態快速篩選（待處理、處理中、已出貨、已送達、已取消）
- ✏️ **訂單編輯** - 即時更新訂單狀態
- ➕ **創建訂單** - 快速創建新訂單
- 🔄 **自動刷新** - 頁面切換時自動重新載入數據

### 訂閱者管理
- 👥 **訂閱者列表** - 完整顯示所有訂閱者資訊
- 📈 **訂閱統計** - 總訂閱者、已訂閱、已終止數量統計
- 🔄 **數據同步** - 從 user_profiles 表同步訂閱者資料
- 💳 **付款狀態** - 顯示定期定額付款狀態
- 📅 **付款日期** - 最後付款和下次付款日期
- 🎨 **全屏管理** - 獨立的全屏管理界面

### UI/UX 設計
- 📱 **響應式設計** - 支援手機、平板、桌面設備
- 🎨 **莫蘭迪色調** - 柔和的視覺風格
- ⚡ **載入優化** - 防抖載入機制減少不必要的請求
- 🔔 **即時反饋** - 操作成功/失敗即時提示

---

## 🛠 技術棧

- **前端框架**: Next.js 14 (App Router)
- **語言**: TypeScript
- **UI 框架**: 
  - Tailwind CSS - 樣式框架
  - shadcn/ui - UI 組件庫
  - Lucide React - 圖標庫
- **後端服務**: Supabase
  - PostgreSQL 數據庫
  - REST API
  - Row Level Security (RLS)
- **狀態管理**: React Hooks
- **工具**:
  - ESLint - 代碼檢查
  - PostCSS - CSS 處理

---

## 💻 環境需求

- Node.js 18.17 或更高版本
- npm 或 yarn 或 pnpm
- Supabase 賬號和專案
- 瀏覽器：Chrome、Firefox、Safari、Edge（最新版本）

---

## 🚀 快速開始

### 1. 克隆專案

\`\`\`bash
cd /Users/SummerTu/Desktop/Sceut/Admin
\`\`\`

### 2. 安裝依賴

\`\`\`bash
npm install
# 或
yarn install
# 或
pnpm install
\`\`\`

### 3. 環境變數設置

複製環境變數範本：

\`\`\`bash
cp env.example .env.local
\`\`\`

編輯 `.env.local`，填入您的 Supabase 配置：

\`\`\`env
# Supabase URL（必填）
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co

# Supabase Anon Key（必填）
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Supabase Service Role Key（必填 - 用於管理後台）
# ⚠️ 重要：此 key 擁有完整資料庫權限，請勿暴露在前端
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
\`\`\`

### 4. 啟動開發伺服器

\`\`\`bash
npm run dev
\`\`\`

訪問 http://localhost:3000 查看管理後台

---

## 🔑 環境變數設置

### 獲取 Supabase Keys

#### 步驟 1: 登入 Supabase Dashboard
訪問 https://supabase.com/dashboard 並選擇您的專案

#### 步驟 2: 獲取 API Keys

1. 在左側導航欄點擊 **⚙️ Settings**
2. 選擇 **API**
3. 在 **Project API keys** 部分找到：

   - **`anon` (public)** - 複製此值到 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **`service_role` (secret)** - 點擊 👁️ 顯示完整 key，複製到 `SUPABASE_SERVICE_ROLE_KEY`

4. **Project URL** - 複製到 `NEXT_PUBLIC_SUPABASE_URL`

#### ⚠️ 安全提醒

- **Service Role Key 擁有完整資料庫權限**，務必妥善保管
- **絕對不要**將 Service Role Key 提交到 Git
- **絕對不要**在前端代碼中使用 Service Role Key
- `.env.local` 已被 `.gitignore` 排除，不會被提交

---

## 💾 數據庫設置

### 必要的資料表

系統需要以下 Supabase 資料表：

#### 1. `orders` 表

\`\`\`sql
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  shopify_order_id TEXT,
  subscriber_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  shipping_address TEXT,
  order_status TEXT NOT NULL DEFAULT 'pending',
  total_price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'NTD',
  payment_status TEXT,
  shipping_status TEXT,
  notes TEXT,
  user_id UUID REFERENCES auth.users(id),
  perfume_name TEXT,
  ratings JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

#### 2. `subscribers` 表

\`\`\`sql
CREATE TABLE subscribers (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  name TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT DEFAULT '台灣',
  quiz_answers JSONB,
  subscription_status TEXT,
  payment_status TEXT,
  payment_method TEXT,
  monthly_fee DECIMAL(10,2),
  last_payment_date TIMESTAMP WITH TIME ZONE,
  next_payment_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

#### 3. `user_profiles` 表

\`\`\`sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT DEFAULT '台灣',
  quiz_answers JSONB,
  recommendations JSONB,
  delivery_method TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
\`\`\`

### Row Level Security (RLS)

**重要**：Admin 使用 Service Role Key 來繞過 RLS 限制，所以可以訪問所有數據。

如果需要設置 RLS 策略，請參考 UserHome 專案中的 SQL 腳本：
- `/UserHome/scripts/01-create-user-profiles.sql`
- `/UserHome/scripts/05-fix-subscribers-table.sql`

---

## 📚 功能使用教學

### 訂單管理

#### 查看訂單列表

1. 進入管理後台 http://localhost:3000
2. 左側導航欄顯示訂單統計：
   - **所有訂單** - 顯示總數
   - **處理中訂單** - 正在處理的訂單
   - **已出貨訂單** - 已發貨的訂單
   - **已送達訂單** - 已完成配送
   - **待處理訂單** - 等待處理

#### 搜尋訂單

在搜尋框輸入：
- 訂單編號
- 客戶姓名
- 客戶郵箱
- Shopify 訂單 ID

#### 過濾訂單

使用下拉選單選擇狀態：
- 🟫 待處理
- 🔵 處理中
- 🟣 已出貨
- 🟢 已送達
- 🔴 已取消

#### 更新訂單狀態

1. 找到要更新的訂單
2. 點擊 **編輯狀態** 按鈕
3. 從下拉選單選擇新狀態
4. 點擊 **儲存**

#### 創建新訂單

1. 點擊左側導航的 **創建新訂單**
2. 填寫訂單資訊
3. 提交創建

---

### 訂閱者管理

#### 查看訂閱者列表

1. 點擊左側導航的 **所有訂閱者 (6)** 按鈕
2. 全屏訂閱者管理頁面會開啟
3. 顯示：
   - 📊 統計卡片（總數、已訂閱、已終止）
   - 📋 詳細訂閱者列表

#### 訂閱者資訊說明

每個訂閱者卡片顯示：

**基本資訊**
- 👤 姓名/郵箱
- 📧 Email
- 📞 電話
- 📅 註冊日期

**訂閱狀態標籤**
- ✓ **已訂閱**（綠色）- 正在訂閱服務
- ✗ **已終止**（紅色）- 訂閱已終止
- ⏳ **待訂閱**（灰色）- 註冊但尚未開始訂閱

**付款資訊**
- 💳 **已付款**（藍色）- 本月已成功扣款
- ⛔ **付款已停止**（紅色）- 定期扣款已終止
- 💰 月費金額
- 💳 付款方式（信用卡定期定額/信用卡）
- 📅 最後付款日期
- 📅 下次付款日期

**其他資訊**
- 📝 測驗資料（已回答問題數量）
- 🕐 最後更新時間

#### 同步訂閱者資料

系統會從 `user_profiles` 表同步數據到 `subscribers` 表：

1. 點擊右上角的 **同步資料** 按鈕
2. 系統會自動：
   - 比對兩個表的數據
   - 更新現有訂閱者資訊（email, name, phone, quiz_answers）
   - 為沒有訂閱記錄的用戶創建新記錄
3. 顯示同步結果彈窗：
   - ✅ 更新：X 筆
   - ➕ 新增：X 筆
   - ❌ 錯誤：X 筆（如有）

#### 重新整理

點擊右上角的 **重新整理** 按鈕重新載入最新數據

#### 關閉訂閱者頁面

使用以下任一方式：
- 點擊左上角 **← 返回** 按鈕
- 點擊右上角 **✕** 按鈕
- 按 `ESC` 鍵（如支援）

---

## 🔌 API 路由說明

### Orders API

#### GET `/api/orders`
獲取所有訂單列表

**回應範例：**
\`\`\`json
{
  "success": true,
  "orders": [
    {
      "id": "123",
      "subscriber_name": "張三",
      "customer_email": "zhang@example.com",
      "order_status": "processing",
      "total_price": 1200,
      ...
    }
  ]
}
\`\`\`

#### PUT `/api/orders`
更新訂單狀態

**請求範例：**
\`\`\`json
{
  "id": "123",
  "order_status": "shipped"
}
\`\`\`

**回應範例：**
\`\`\`json
{
  "success": true,
  "order": { ... }
}
\`\`\`

---

### Subscribers API

#### GET `/api/subscribers`
獲取所有訂閱者列表

**回應範例：**
\`\`\`json
{
  "success": true,
  "subscribers": [
    {
      "id": 1,
      "name": "李四",
      "email": "li@example.com",
      "subscription_status": "active",
      "payment_status": "paid",
      "monthly_fee": 599,
      ...
    }
  ],
  "count": 6
}
\`\`\`

#### POST `/api/subscribers`
同步訂閱者資料

**請求範例：**
\`\`\`json
{
  "action": "sync"
}
\`\`\`

**回應範例：**
\`\`\`json
{
  "success": true,
  "message": "同步完成",
  "stats": {
    "totalProfiles": 41,
    "synced": 3,
    "created": 2,
    "errors": 0
  },
  "errors": []
}
\`\`\`

---

### Users API

#### GET `/api/users`
獲取用戶資料（用於測試）

---

## 📁 專案結構

\`\`\`
Admin/
├── app/                          # Next.js App Router
│   ├── api/                      # API 路由
│   │   ├── orders/
│   │   │   └── route.ts         # 訂單 API
│   │   ├── subscribers/
│   │   │   └── route.ts         # 訂閱者 API（新增）
│   │   ├── users/
│   │   │   └── route.ts         # 用戶 API
│   │   └── check-data/
│   │       └── route.ts         # 數據檢查 API
│   ├── orders/
│   │   └── page.tsx             # 訂單管理頁面
│   ├── test-db/
│   │   └── page.tsx             # 資料庫測試頁面
│   ├── auth-provider.tsx        # 認證提供者
│   ├── layout.tsx               # 根布局
│   ├── page.tsx                 # 首頁（重定向）
│   └── globals.css              # 全域樣式
├── components/
│   ├── ui/                      # shadcn/ui 組件
│   │   ├── alert.tsx
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── ...
│   ├── create-order-dialog.tsx  # 創建訂單對話框
│   └── subscribers-dialog.tsx   # 訂閱者管理對話框（新增）
├── hooks/
│   └── use-debounced-loading.ts # 防抖載入 Hook
├── lib/
│   ├── supabase/
│   │   └── client.ts            # Supabase 客戶端
│   └── utils.ts                 # 工具函數
├── .env.local                   # 環境變數（需自行創建）
├── .gitignore                   # Git 忽略文件
├── env.example                  # 環境變數範本
├── SETUP_ADMIN.md              # 設置指南
├── README.md                    # 本文件
├── components.json              # shadcn/ui 配置
├── next.config.mjs              # Next.js 配置
├── package.json                 # 依賴管理
├── postcss.config.mjs           # PostCSS 配置
├── tailwind.config.ts           # Tailwind CSS 配置
└── tsconfig.json                # TypeScript 配置
\`\`\`

---

## 👨‍💻 開發指南

### 開發模式

\`\`\`bash
npm run dev
\`\`\`
- 啟動開發伺服器：http://localhost:3000
- 支援熱重載（Hot Reload）
- 顯示詳細錯誤信息

### 建構生產版本

\`\`\`bash
npm run build
\`\`\`
- 產生優化的生產版本
- 檢查 TypeScript 錯誤
- 優化圖片和資源

### 啟動生產伺服器

\`\`\`bash
npm start
\`\`\`
- 需要先運行 `npm run build`
- 生產環境優化

### 程式碼檢查

\`\`\`bash
npm run lint
\`\`\`
- 使用 ESLint 檢查代碼質量
- 自動修復簡單問題

### 目錄說明

- **`/app`** - Next.js 14 App Router，包含頁面和 API 路由
- **`/components`** - React 組件，包括 UI 組件和業務組件
- **`/hooks`** - 自定義 React Hooks
- **`/lib`** - 工具函數和配置
- **`/public`** - 靜態資源

---

## 🔧 疑難排解

### 問題 1: 無法看到訂閱者數據

**症狀**：點擊"所有訂閱者"顯示 0 筆或顯示錯誤

**原因**：未設置 `SUPABASE_SERVICE_ROLE_KEY` 或設置錯誤

**解決方法**：
1. 檢查 `.env.local` 文件是否存在
2. 確認 `SUPABASE_SERVICE_ROLE_KEY` 已正確填入
3. 確保 key 沒有多餘的空格或換行
4. 重啟開發伺服器：按 `Ctrl+C` 停止，然後 `npm run dev`

**驗證**：
\`\`\`bash
# 檢查環境變數文件
cat .env.local | grep SUPABASE_SERVICE_ROLE_KEY

# 測試 API
curl http://localhost:3000/api/subscribers
\`\`\`

---

### 問題 2: 401 Unauthorized 錯誤

**症狀**：API 返回 401 錯誤，提示 "Invalid API key"

**原因**：Service Role Key 無效或未正確設置

**解決方法**：
1. 重新從 Supabase Dashboard 獲取 Service Role Key
2. 確保複製完整的 key（通常很長）
3. 檢查 key 前後沒有空格
4. 重啟開發伺服器

---

### 問題 3: 數據不同步

**症狀**：訂閱者數據和實際不符

**解決方法**：
1. 打開訂閱者管理頁面
2. 點擊右上角的 **同步資料** 按鈕
3. 等待同步完成
4. 點擊 **重新整理** 查看最新數據

---

### 問題 4: 訂單列表空白

**可能原因**：
- 數據庫中沒有訂單數據
- 網絡連接問題
- Supabase API 配置錯誤

**解決方法**：
1. 檢查瀏覽器控制台（F12）是否有錯誤
2. 檢查終端日誌
3. 確認 Supabase 配置正確
4. 測試數據庫連接：訪問 http://localhost:3000/test-db

---

### 問題 5: 樣式顯示異常

**解決方法**：
\`\`\`bash
# 清除 Next.js 快取
rm -rf .next

# 重新安裝依賴
rm -rf node_modules
npm install

# 重新啟動
npm run dev
\`\`\`

---

### 問題 6: 開發伺服器無法啟動

**可能原因**：
- 端口 3000 被占用
- Node.js 版本過舊

**解決方法**：
\`\`\`bash
# 檢查 Node.js 版本（需要 18.17+）
node --version

# 更換端口
PORT=3001 npm run dev

# 或在 package.json 修改 scripts
"dev": "next dev -p 3001"
\`\`\`

---

## 📞 技術支援

### 查看日誌

**瀏覽器控制台**：
- 按 `F12` 或 `Cmd+Option+I`（Mac）
- 查看 **Console** 標籤

**開發伺服器終端**：
- 查看運行 `npm run dev` 的終端窗口
- API 請求和錯誤會顯示在這裡

### 測試工具

**資料庫測試頁面**：
訪問 http://localhost:3000/test-db
- 測試 Supabase 連接
- 檢查 Service Role Key 是否正確
- 查看資料表數據統計

### 有用的命令

\`\`\`bash
# 查看環境變數（隱藏敏感信息）
grep SUPABASE .env.local | sed 's/=.*/=***/'

# 測試 API
curl http://localhost:3000/api/subscribers
curl http://localhost:3000/api/orders

# 檢查端口占用
lsof -i :3000

# 清除所有快取和重新開始
rm -rf .next node_modules package-lock.json
npm install
npm run dev
\`\`\`

---

## 📝 更新日誌

### v1.1.0 (最新)
- ✨ 新增訂閱者管理功能
- 🎨 全屏訂閱者管理界面
- 🔄 數據同步功能（user_profiles ↔ subscribers）
- 📊 訂閱者統計儀表板
- 💳 付款狀態顯示
- 🐛 修復多個 bug
- 📚 完善文檔

### v1.0.0
- 🎉 初始版本
- 📦 訂單管理功能
- 🔍 搜尋和過濾
- ✏️ 訂單狀態編輯
- 📱 響應式設計

---

## 📄 授權

此專案為 Sceut 內部管理系統，版權所有。

---

## 👥 維護團隊

如有問題或建議，請聯繫開發團隊。

---

**最後更新**: 2025-10-04  
**版本**: v1.1.0  
**文檔版本**: 1.0
