/**
 * 组装客户发票 PDF 所需数据（Prisma + 行格式化）
 */

import prisma from '@/lib/prisma'
import type { InvoicePdfLineRow, InvoicePdfPayload } from './invoice-pdf-types'

function formatYmd(d: Date | string | null | undefined): string {
  if (d == null) return '-'
  if (typeof d === 'string') {
    const s = d.split('T')[0]
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '-'
  }
  return d.toISOString().slice(0, 10)
}

function formatMoney(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatQty(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
}

function formatPrintParts(now: Date): { date: string; time: string } {
  const tz = 'America/Los_Angeles'
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now)
  return { date, time }
}

/** Bill To：优先客户名称；无名称时用客户代码中第一个「-」前的部分（不写 xxx-OAK 后缀） */
function formatBillToDisplay(cust: { code: string | null; name: string | null } | null | undefined): string {
  if (!cust) return '-'
  const name = cust.name?.trim()
  if (name) return name
  const code = cust.code?.trim()
  if (!code) return '-'
  const i = code.indexOf('-')
  if (i > 0) return code.slice(0, i)
  return code
}

export async function buildInvoicePdfPayload(
  invoiceId: bigint,
  logoDataUrl: string | null
): Promise<InvoicePdfPayload | null> {
  const invoice = await prisma.invoices.findUnique({
    where: { invoice_id: invoiceId },
    include: {
      customers: { select: { code: true, name: true } },
      // orders 无 container_number，柜号即 order_number（与 OMS/入库等一致）
      orders: { select: { order_number: true } },
    },
  })
  if (!invoice) return null

  const linesDb = await prisma.invoice_line_items.findMany({
    where: { invoice_id: invoiceId },
    orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
  })

  const feeIds = [...new Set(linesDb.map((l) => l.fee_id).filter((id): id is bigint => id != null))]
  const fees =
    feeIds.length > 0
      ? await prisma.fee.findMany({
          where: { id: { in: feeIds } },
          select: { id: true, fee_code: true, fee_name: true },
        })
      : []
  const feeById = new Map(fees.map((f) => [f.id.toString(), f]))

  const lines: InvoicePdfLineRow[] = linesDb.map((line) => {
    const fee = line.fee_id != null ? feeById.get(line.fee_id.toString()) : undefined
    const code = (line.fee_code ?? fee?.fee_code ?? '').trim() || '-'
    const name = (line.fee_name ?? fee?.fee_name ?? '').trim() || '-'
    const notes = (line.line_notes ?? '').trim()
    const qty = Number(line.quantity)
    const unit = Number(line.unit_price)
    const amt = Number(line.total_amount)
    return {
      fee_code: code,
      fee_name: name,
      notes,
      unit_price: formatMoney(Number.isFinite(unit) ? unit : 0),
      quantity: formatQty(Number.isFinite(qty) ? qty : 0),
      amount: formatMoney(Number.isFinite(amt) ? amt : 0),
    }
  })

  const totalNum = Number(invoice.total_amount)
  const totalAmount = formatMoney(Number.isFinite(totalNum) ? totalNum : 0)

  const billToName = formatBillToDisplay(invoice.customers ?? null)

  const container = invoice.orders?.order_number?.trim() || '-'

  const now = new Date()
  const { date: printTimeDate, time: printTimeTime } = formatPrintParts(now)

  return {
    printTimeDate,
    printTimeTime,
    invoiceDateYmd: formatYmd(invoice.invoice_date),
    containerNumber: container,
    invoiceNumber: invoice.invoice_number,
    billToName,
    lines,
    totalAmount,
    logoDataUrl,
  }
}
