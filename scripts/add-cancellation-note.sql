-- 為 orders 表添加取消備注欄位
-- 如果 cancellation_note 欄位不存在，則創建它

DO $$
BEGIN
    -- 檢查 cancellation_note 欄位是否存在
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'cancellation_note'
    ) THEN
        -- 如果不存在，添加 cancellation_note 欄位
        ALTER TABLE "public"."orders" 
        ADD COLUMN "cancellation_note" TEXT;
        
        RAISE NOTICE '已添加 cancellation_note 欄位到 orders 表';
    ELSE
        RAISE NOTICE 'cancellation_note 欄位已存在於 orders 表';
    END IF;
END $$;

-- 添加註釋說明欄位用途
COMMENT ON COLUMN "public"."orders"."cancellation_note" IS '訂單取消時的備注資訊';
