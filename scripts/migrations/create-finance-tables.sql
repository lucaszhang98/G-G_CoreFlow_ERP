-- 财务管理 Phase 1：在 public schema 下创建 4 张表
-- 执行前请确认：数据库已有 customers、orders、users 表
-- 在 PostgreSQL 中执行本文件即可（无需 Prisma 迁移）

-- 1. 发票表
CREATE TABLE IF NOT EXISTS public.invoices (
  invoice_id       BIGSERIAL PRIMARY KEY,
  invoice_number   VARCHAR(50) NOT NULL UNIQUE,
  customer_id      BIGINT NOT NULL REFERENCES public.customers(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  order_id         BIGINT REFERENCES public.orders(order_id) ON DELETE SET NULL ON UPDATE NO ACTION,
  total_amount     DECIMAL(12, 2) NOT NULL,
  tax_amount       DECIMAL(12, 2) DEFAULT 0,
  currency         VARCHAR(10) DEFAULT 'USD',
  invoice_date     DATE NOT NULL,
  status           VARCHAR(20) DEFAULT 'draft',
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  created_by       BIGINT REFERENCES public.users(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  updated_by       BIGINT REFERENCES public.users(id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_invoices_customer ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_order ON public.invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON public.invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);

-- 2. 应收表
CREATE TABLE IF NOT EXISTS public.receivables (
  receivable_id     BIGSERIAL PRIMARY KEY,
  invoice_id       BIGINT NOT NULL REFERENCES public.invoices(invoice_id) ON DELETE CASCADE ON UPDATE NO ACTION,
  customer_id      BIGINT NOT NULL REFERENCES public.customers(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  receivable_amount DECIMAL(12, 2) NOT NULL,
  allocated_amount DECIMAL(12, 2) DEFAULT 0,
  balance          DECIMAL(12, 2),
  due_date         DATE,
  status           VARCHAR(20) DEFAULT 'open',
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  created_by       BIGINT REFERENCES public.users(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  updated_by       BIGINT REFERENCES public.users(id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_receivables_invoice ON public.receivables(invoice_id);
CREATE INDEX IF NOT EXISTS idx_receivables_customer ON public.receivables(customer_id);
CREATE INDEX IF NOT EXISTS idx_receivables_due_date ON public.receivables(due_date);
CREATE INDEX IF NOT EXISTS idx_receivables_status ON public.receivables(status);

-- 3. 收款表
CREATE TABLE IF NOT EXISTS public.payments (
  payment_id       BIGSERIAL PRIMARY KEY,
  customer_id      BIGINT NOT NULL REFERENCES public.customers(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  payment_date     DATE NOT NULL,
  amount          DECIMAL(12, 2) NOT NULL,
  currency        VARCHAR(10) DEFAULT 'USD',
  payment_method  VARCHAR(50),
  bank_reference  VARCHAR(100),
  notes           TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  created_by       BIGINT REFERENCES public.users(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  updated_by       BIGINT REFERENCES public.users(id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_payments_customer ON public.payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments(payment_date);

-- 4. 收款核销表
CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id               BIGSERIAL PRIMARY KEY,
  payment_id       BIGINT NOT NULL REFERENCES public.payments(payment_id) ON DELETE CASCADE ON UPDATE NO ACTION,
  receivable_id    BIGINT NOT NULL REFERENCES public.receivables(receivable_id) ON DELETE CASCADE ON UPDATE NO ACTION,
  allocated_amount DECIMAL(12, 2) NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now(),
  created_by       BIGINT,
  UNIQUE (payment_id, receivable_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment ON public.payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_receivable ON public.payment_allocations(receivable_id);
