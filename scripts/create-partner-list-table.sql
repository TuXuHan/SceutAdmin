-- 創建互惠對象名單表
-- 這個表用於存儲合作對象的資訊，與 subscribers 表分開管理

CREATE TABLE IF NOT EXISTS public.partner_list (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    address TEXT, -- 允許 NULL
    city TEXT,
    postal_code TEXT,
    country TEXT DEFAULT '台灣',
    delivery_method TEXT, -- 'home' 或 '711'
    "711" TEXT, -- 7-11 門市名稱
    quiz_answers JSONB, -- 問答答案
    subscription_status TEXT DEFAULT 'active', -- 訂閱狀態
    monthly_fee DECIMAL(10,2) DEFAULT 599, -- 月費
    payment_method TEXT DEFAULT 'CREDIT', -- 付款方式
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 創建索引以提高查詢性能
CREATE INDEX IF NOT EXISTS idx_partner_list_user_id ON public.partner_list(user_id);
CREATE INDEX IF NOT EXISTS idx_partner_list_email ON public.partner_list(email);
CREATE INDEX IF NOT EXISTS idx_partner_list_name ON public.partner_list(name);

-- 添加註釋
COMMENT ON TABLE public.partner_list IS '互惠對象名單表，用於存儲合作對象的資訊';
COMMENT ON COLUMN public.partner_list.user_id IS '關聯到 user_profiles 的 user_id';
COMMENT ON COLUMN public.partner_list.delivery_method IS '配送方式：home (宅配) 或 711 (7-11超商)';
