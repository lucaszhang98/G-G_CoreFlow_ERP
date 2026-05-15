/**
 * 费用在账单明细中的「核销/引用」记录：按 fee_id 或行上快照 fee_code+fee_name 与主数据一致匹配。
 */

import type { Prisma, PrismaClient } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

export const FEE_INVOICE_LINE_INVOICE_TYPE_LABEL: Record<string, string> = {
  direct_delivery: '直送',
  unload: '拆柜',
  penalty: '负数',
  storage: '仓储',
}

export const FEE_INVOICE_LINE_STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  audited: '已审核',
  issued: '已开票',
  void: '作废',
}

export type FeeInvoiceLineUsageRow = {
  line_id: bigint
  invoice_id: bigint
  invoice_number: string
  invoice_date: Date | null
  invoice_type: string | null
  invoice_status: string | null
  customer_code: string | null
  customer_name: string | null
  order_number: string | null
  fee_code: string | null
  fee_name: string | null
  unit: string | null
  unit_price: Prisma.Decimal
  quantity: Prisma.Decimal
  total_amount: Prisma.Decimal
  currency: string | null
  line_notes: string | null
  created_at: Date | null
}

export async function getFeeInvoiceLinesUsage(
  db: Db,
  feeId: bigint
): Promise<{ fee: { fee_code: string; fee_name: string } | null; rows: FeeInvoiceLineUsageRow[] }> {
  const fee = await db.fee.findUnique({
    where: { id: feeId },
    select: { id: true, fee_code: true, fee_name: true },
  })
  if (!fee) {
    return { fee: null, rows: [] }
  }

  const code = (fee.fee_code ?? '').trim()
  const name = (fee.fee_name ?? '').trim()

  const or: Prisma.invoice_line_itemsWhereInput[] = [{ fee_id: feeId }]
  if (code && name) {
    or.push({
      fee_id: null,
      fee_code: code,
      fee_name: name,
    })
  }

  const raw = await db.invoice_line_items.findMany({
    where: { OR: or },
    include: {
      invoices: {
        select: {
          invoice_id: true,
          invoice_number: true,
          invoice_date: true,
          invoice_type: true,
          status: true,
          currency: true,
          customers: { select: { code: true, name: true } },
          orders: { select: { order_number: true } },
        },
      },
    },
    orderBy: { id: 'desc' },
    take: 20_000,
  })

  const rows: FeeInvoiceLineUsageRow[] = raw.map((r) => {
    const inv = r.invoices
    return {
      line_id: r.id,
      invoice_id: r.invoice_id,
      invoice_number: inv?.invoice_number ?? '',
      invoice_date: inv?.invoice_date ?? null,
      invoice_type: inv?.invoice_type ?? null,
      invoice_status: inv?.status ?? null,
      customer_code: inv?.customers?.code ?? null,
      customer_name: inv?.customers?.name ?? null,
      order_number: inv?.orders?.order_number ?? null,
      fee_code: r.fee_code,
      fee_name: r.fee_name,
      unit: r.unit,
      unit_price: r.unit_price,
      quantity: r.quantity,
      total_amount: r.total_amount,
      currency: inv?.currency ?? null,
      line_notes: r.line_notes,
      created_at: r.created_at ?? null,
    }
  })

  rows.sort((a, b) => {
    const ta = a.invoice_date ? new Date(a.invoice_date).getTime() : 0
    const tb = b.invoice_date ? new Date(b.invoice_date).getTime() : 0
    if (ta !== tb) return ta - tb
    if (a.line_id < b.line_id) return -1
    if (a.line_id > b.line_id) return 1
    return 0
  })

  return { fee: { fee_code: fee.fee_code, fee_name: fee.fee_name }, rows }
}
