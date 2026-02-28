-- 為 orders 表添加宅配地址欄位
-- 如果 shipping_address 欄位不存在，則創建它

DO $$
BEGIN
    -- 檢查 shipping_address 欄位是否存在
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'shipping_address'
    ) THEN
        -- 如果不存在，添加 shipping_address 欄位
        ALTER TABLE "public"."orders" 
        ADD COLUMN "shipping_address" TEXT;
        
        RAISE NOTICE '已添加 shipping_address 欄位到 orders 表';
    ELSE
        RAISE NOTICE 'shipping_address 欄位已存在於 orders 表';
    END IF;
END $$;

-- 添加註釋說明欄位用途
COMMENT ON COLUMN "public"."orders"."shipping_address" IS '宅配配送地址，當 delivery_method 為 home 時使用';

-- 顯示結果
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'orders' 
    AND table_schema = 'public'
    AND column_name = 'shipping_address';
