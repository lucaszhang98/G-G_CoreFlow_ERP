-- 费用主数据：fee + fee_scope（归属范围）
-- 执行前请确认：数据库已有 customers、users 表
-- 在 PostgreSQL 中执行本文件即可

-- 1. 费用主表
CREATE TABLE IF NOT EXISTS public.fee (
  id               BIGSERIAL PRIMARY KEY,
  fee_code         VARCHAR(50) NOT NULL,
  fee_name         VARCHAR(100) NOT NULL,
  unit             VARCHAR(20),
  unit_price       DECIMAL(12, 2) NOT NULL,
  currency         VARCHAR(10) DEFAULT 'USD',
  scope_type       VARCHAR(20) NOT NULL,
  description      TEXT,
  sort_order       INT DEFAULT 0,
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  created_by       BIGINT REFERENCES public.users(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  updated_by       BIGINT REFERENCES public.users(id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_fee_fee_code ON public.fee(fee_code);
CREATE INDEX IF NOT EXISTS idx_fee_scope_type ON public.fee(scope_type);

-- 2. 费用归属范围表（scope_type='customers' 时使用）
CREATE TABLE IF NOT EXISTS public.fee_scope (
  id               BIGSERIAL PRIMARY KEY,
  fee_id           BIGINT NOT NULL REFERENCES public.fee(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  customer_id      BIGINT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (fee_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_fee_scope_fee ON public.fee_scope(fee_id);
CREATE INDEX IF NOT EXISTS idx_fee_scope_customer ON public.fee_scope(customer_id);
