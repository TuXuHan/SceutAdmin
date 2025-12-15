-- 新增訂閱月數欄位給 partner_list
ALTER TABLE public.partner_list
ADD COLUMN IF NOT EXISTS subscription_months INTEGER;

COMMENT ON COLUMN public.partner_list.subscription_months IS '累計或方案的訂閱月數';

