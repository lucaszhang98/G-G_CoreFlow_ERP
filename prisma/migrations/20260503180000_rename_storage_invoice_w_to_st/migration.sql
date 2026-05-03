-- 历史仓储账单发票号：W + yyyyMM + 4 位序号 → ST + yyyyMM + 4 位序号（与 getNextStorageInvoiceNumber 一致）
-- 先更新无冲突行；再对仍残留 W 前缀且目标号已被占用的行追加后缀避免违反 invoice_number 唯一约束

UPDATE "public"."invoices" i
SET invoice_number = 'ST' || substring(i.invoice_number FROM 2)
WHERE i.invoice_type = 'storage'
  AND i.invoice_number ~ '^W[0-9]{10}$'
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."invoices" x
    WHERE x.invoice_number = ('ST' || substring(i.invoice_number FROM 2))
      AND x.invoice_id <> i.invoice_id
  );

-- 极少数：目标 ST… 已被其他记录占用时，改为 ST + 原 10 位数字 + 短后缀（仍唯一）
UPDATE "public"."invoices" i
SET invoice_number = ('ST' || substring(i.invoice_number FROM 2) || '-R' || i.invoice_id::text)
WHERE i.invoice_type = 'storage'
  AND i.invoice_number ~ '^W[0-9]{10}$';
