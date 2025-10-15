-- 為 subscribers 表添加配送相關欄位
-- 執行此腳本前請確保已備份資料庫

-- 添加 delivery_method 欄位
ALTER TABLE "public"."subscribers" 
ADD COLUMN IF NOT EXISTS "delivery_method" TEXT;

-- 添加 711 欄位（使用引號因為欄位名包含數字）
ALTER TABLE "public"."subscribers" 
ADD COLUMN IF NOT EXISTS "711" TEXT;

-- 添加註釋說明
COMMENT ON COLUMN "public"."subscribers"."delivery_method" IS '配送方式：home=宅配, 711=7-11超商';
COMMENT ON COLUMN "public"."subscribers"."711" IS '7-11門市名稱';

-- 更新現有記錄的預設值（可選）
-- UPDATE "public"."subscribers" 
-- SET "delivery_method" = 'home' 
-- WHERE "delivery_method" IS NULL;

-- 顯示結果
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'subscribers' 
    AND table_schema = 'public'
    AND column_name IN ('delivery_method', '711')
ORDER BY column_name;
