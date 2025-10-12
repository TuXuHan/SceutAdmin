# OpenAI API 設置指南

## 環境變量配置

為了使用 OpenAI 生成香水推薦功能，您需要設置以下環境變量：

### 1. 創建 .env.local 文件

在 Admin 目錄下創建 `.env.local` 文件，並添加以下內容：

```bash
# Supabase 配置
NEXT_PUBLIC_SUPABASE_URL=https://bbrnbyzjmxgxnczzymdt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# OpenAI 配置
OPENAI_API_KEY=your_openai_api_key_here
```

### 2. 獲取 OpenAI API 金鑰

1. 訪問 [OpenAI Platform](https://platform.openai.com/)
2. 登錄或註冊帳戶
3. 前往 [API Keys](https://platform.openai.com/account/api-keys) 頁面
4. 點擊 "Create new secret key"
5. 複製生成的 API 金鑰
6. 將金鑰貼到 `.env.local` 文件中的 `OPENAI_API_KEY` 變量

### 3. 重新啟動開發服務器

設置完環境變量後，重新啟動開發服務器：

```bash
npm run dev
```

## 功能說明

### AI 推薦系統

- **模型**: 使用 GPT-4o-mini 模型
- **輸入**: 用戶的測驗答案
- **輸出**: 3個個人化香水推薦（主要、次要、替代）

### 推薦內容包含

每個推薦包含：
- 香水名稱和品牌
- 詳細描述
- 匹配度百分比 (60-95%)
- 3個具體推薦理由

### 備用機制

如果 OpenAI API 調用失敗，系統會自動使用備用推薦，確保功能正常運行。

## 使用方式

1. 進入訂閱者管理頁面
2. 點擊任何訂閱者卡片展開詳細資訊
3. 點擊「生成個人化推薦」按鈕
4. 等待 AI 生成推薦結果（通常需要 3-10 秒）
5. 查看個人化推薦結果

## 成本考量

- GPT-4o-mini 是較經濟的模型選擇
- 每次推薦調用約消耗 1000-1500 tokens
- 建議監控 API 使用量和成本

## 故障排除

### 常見問題

1. **API 金鑰無效**
   - 檢查 `.env.local` 文件中的 `OPENAI_API_KEY`
   - 確認金鑰沒有過期或被撤銷

2. **推薦生成失敗**
   - 檢查網絡連接
   - 查看控制台錯誤日誌
   - 系統會自動使用備用推薦

3. **環境變量未生效**
   - 重新啟動開發服務器
   - 確認 `.env.local` 文件位置正確

### 調試

查看控制台日誌以獲取詳細錯誤信息：
- 瀏覽器開發者工具 (F12)
- 服務器終端輸出

## 安全注意事項

1. **不要提交 API 金鑰到版本控制**
   - `.env.local` 文件已在 `.gitignore` 中
   - 不要在代碼中硬編碼金鑰

2. **API 金鑰保護**
   - 定期輪換 API 金鑰
   - 設置適當的使用限制
   - 監控異常使用情況

3. **生產環境**
   - 使用環境變量管理服務
   - 設置適當的訪問控制
   - 定期審查 API 使用情況
