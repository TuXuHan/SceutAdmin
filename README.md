# Admin Orders Management

管理訂單系統，基於Next.js和Supabase建構。

## 功能特色

- 📊 訂單統計儀表板
- 🔍 訂單搜尋和過濾
- 📋 訂單列表管理
- 🎨 響應式設計
- 🔐 用戶認證

## 技術棧

- **前端**: Next.js 14, React 18, TypeScript
- **UI**: Tailwind CSS, shadcn/ui
- **後端**: Supabase
- **圖標**: Lucide React

## 安裝和設定

1. 安裝依賴：
```bash
npm install
```

2. 設定環境變數：
```bash
cp env.example .env.local
```

編輯 `.env.local` 檔案，填入你的Supabase配置：
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. 啟動開發伺服器：
```bash
npm run dev
```

## 專案結構

```
Admin/
├── app/
│   ├── auth-provider.tsx    # 認證提供者
│   ├── layout.tsx          # 根布局
│   ├── page.tsx            # 訂單管理頁面
│   └── globals.css         # 全域樣式
├── components/
│   └── ui/                 # UI組件
├── hooks/
│   └── use-debounced-loading.ts  # 防抖載入hook
├── lib/
│   ├── supabase/
│   │   └── client.ts       # Supabase客戶端
│   └── utils.ts            # 工具函數
└── package.json
```

## 使用方式

1. 訪問管理頁面
2. 使用搜尋框快速找到特定訂單
3. 使用狀態過濾器查看特定狀態的訂單
4. 點擊"查看"或"編輯"按鈕進行訂單操作

## 開發

```bash
# 開發模式
npm run dev

# 建構
npm run build

# 啟動生產版本
npm start

# 程式碼檢查
npm run lint
```
# SceutAdmin
