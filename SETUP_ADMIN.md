# Admin 後台設置指南

## 獲取 Supabase Service Role Key

為了讓管理後台能夠訪問所有訂閱者數據（繞過 RLS 限制），您需要設置 `SUPABASE_SERVICE_ROLE_KEY`。

### 步驟：

1. **登入 Supabase Dashboard**
   - 訪問 https://supabase.com/dashboard
   - 選擇您的項目

2. **獲取 Service Role Key**
   - 在左側導航欄中，點擊 **Settings** (設置圖標)
   - 選擇 **API** 
   - 在 **Project API keys** 部分，找到 `service_role` key
   - 點擊眼睛圖標顯示完整的 key
   - 複製這個 key

3. **設置環境變量**
   
   **方法 1: 創建 `.env.local` 文件**
   ```bash
   cd /Users/SummerTu/Desktop/Sceut/Admin
   cp env.example .env.local
   ```
   
   編輯 `.env.local` 文件，添加：
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://bbrnbyzjmxgxnczzymdt.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJicm5ieXpqbXhneG5jenp5bWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwNDQ3ODcsImV4cCI6MjA2MDYyMDc4N30.S5BFoAq6idmTKLwGYa0bhxFVEoEmQ3voshyX03FVe0Y
   SUPABASE_SERVICE_ROLE_KEY=你的_service_role_key_在這裡
   ```

   **方法 2: 直接在終端設置（臨時）**
   ```bash
   export SUPABASE_SERVICE_ROLE_KEY="你的_service_role_key_在這裡"
   ```

4. **重啟開發伺服器**
   ```bash
   npm run dev
   # 或
   yarn dev
   ```

## ⚠️ 安全提醒

- **Service Role Key 擁有完整資料庫權限**，請妥善保管
- **絕對不要**將此 key 提交到 Git 或暴露在前端代碼中
- `.env.local` 已經被 `.gitignore` 排除，不會被提交
- 此 key 只應該在服務端 API 路由中使用（如 `/api/subscribers/route.ts`）

## 驗證設置

設置完成後，重新訪問 Admin 頁面：

1. 點擊左側導航的 "查看所有訂閱者"
2. 檢查終端日誌，應該看到：
   ```
   🔑 使用的 Key 类型: SERVICE_ROLE_KEY
   ```
3. 如果看到 `ANON_KEY`，表示環境變量未正確設置

## 功能說明

### 訂閱者管理
- **查看所有訂閱者**: 顯示系統中所有訂閱者的詳細信息
- **同步資料**: 將 `user_profiles` 表的數據同步到 `subscribers` 表
  - 如果訂閱者已存在，更新其資料（email, name, phone, quiz_answers）
  - 如果訂閱者不存在，創建新記錄
  - 顯示同步統計（更新數量、新增數量、錯誤數量）

### 訂單管理
- 查看所有訂單
- 按狀態過濾（待處理、處理中、已出貨、已送達、已取消）
- 編輯訂單狀態
- 創建新訂單

## 疑難排解

### 問題：看不到任何訂閱者

**原因**: 使用的是 ANON_KEY，受 RLS 限制

**解決方法**:
1. 確認已設置 `SUPABASE_SERVICE_ROLE_KEY` 環境變量
2. 重啟開發伺服器
3. 檢查終端日誌確認使用的 key 類型

### 問題：同步失敗

**可能原因**:
- 資料庫連接問題
- 權限不足
- 資料格式錯誤

**解決方法**:
1. 檢查終端日誌查看詳細錯誤信息
2. 確認兩個表的結構是否匹配
3. 檢查 Supabase Dashboard 中的日誌

## 支援

如有問題，請檢查：
- 終端控制台的錯誤日誌
- Supabase Dashboard 的 Logs 部分
- 瀏覽器開發者工具的 Network 和 Console 標籤

