import prisma from '@/lib/prisma'
import type { PrismaClient } from '@prisma/client'

/**
 * 根据账单明细重新计算发票总金额并更新 invoices.total_amount
 */
export async function recalcInvoiceTotal(invoiceId: bigint, tx?: PrismaClient): Promise<void> {
  const db = tx ?? prisma
  const agg = await db.invoice_line_items.aggregate({
    where: { invoice_id: invoiceId },
    _sum: { total_amount: true },
  })
  const total = agg._sum?.total_amount ?? 0
  await db.invoices.update({
    where: { invoice_id: invoiceId },
    data: { total_amount: total },
  })
}
