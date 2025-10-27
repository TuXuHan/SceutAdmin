-- 為 orders 表添加 customer_phone 欄位
-- 執行此腳本前請確保已備份資料庫

-- 添加 customer_phone 欄位
ALTER TABLE "public"."orders" 
ADD COLUMN IF NOT EXISTS "customer_phone" TEXT;

-- 添加註釋說明
COMMENT ON COLUMN "public"."orders"."customer_phone" IS '客戶電話號碼';

-- 顯示結果
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'orders' 
    AND table_schema = 'public'
    AND column_name = 'customer_phone'
ORDER BY column_name;
