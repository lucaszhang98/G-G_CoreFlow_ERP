import prisma from '@/lib/prisma'

export type ReceivableSummaryRow = {
  customerId: string
  customerCode: string
  customerName: string
  /** 各自然月（YYYY-MM）余额合计，缺省为 0 */
  byMonth: Record<string, number>
  rowTotal: number
}

export type ReceivablesSummaryMatrix = {
  months: string[]
  rows: ReceivableSummaryRow[]
  columnTotals: Record<string, number>
  grandTotal: number
}

function monthKeyFromInvoiceDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() + 1
  return `${y}-${String(m).padStart(2, '0')}`
}

function parseYm(ym: string): { y: number; m: number } {
  const [ys, ms] = ym.split('-')
  return { y: parseInt(ys, 10), m: parseInt(ms, 10) }
}

/** 含端点：fromYm、toYm 均为 YYYY-MM */
export function enumerateMonthsInclusive(fromYm: string, toYm: string): string[] {
  const a = parseYm(fromYm)
  const b = parseYm(toYm)
  if (!Number.isFinite(a.y) || !Number.isFinite(a.m) || !Number.isFinite(b.y) || !Number.isFinite(b.m)) {
    return []
  }
  const out: string[] = []
  let y = a.y
  let mo = a.m
  for (;;) {
    const key = `${y}-${String(mo).padStart(2, '0')}`
    out.push(key)
    if (y === b.y && mo === b.m) break
    mo += 1
    if (mo > 12) {
      mo = 1
      y += 1
    }
    if (y > b.y + 1) break
  }
  return out
}

function ymCompare(a: string, b: string): number {
  return a.localeCompare(b)
}

function toNumber(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'object' && v !== null && 'toNumber' in v && typeof (v as { toNumber: () => number }).toNumber === 'function') {
    return (v as { toNumber: () => number }).toNumber()
  }
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * 有余额的应收行，按客户 × 发票开票月份（invoice_date 所在月）汇总余额。
 * 列：数据中出现的最小月至最大月（连续自然月）。
 */
export async function buildReceivablesSummaryMatrix(): Promise<ReceivablesSummaryMatrix> {
  const receivables = await prisma.receivables.findMany({
    where: {
      balance: { gt: 0 },
    },
    select: {
      customer_id: true,
      balance: true,
      due_date: true,
      invoices: {
        select: { invoice_date: true },
      },
      customers: {
        select: { id: true, code: true, name: true },
      },
    },
  })

  if (receivables.length === 0) {
    return { months: [], rows: [], columnTotals: {}, grandTotal: 0 }
  }

  const monthSet = new Set<string>()
  type Agg = {
    code: string
    name: string
    byMonth: Record<string, number>
    rowTotal: number
  }
  const byCustomer = new Map<string, Agg>()

  for (const r of receivables) {
    const bal = toNumber(r.balance)
    if (bal <= 0) continue

    const invDate = r.invoices?.invoice_date
    const fallback = r.due_date
    const dateForMonth =
      invDate != null ? (invDate instanceof Date ? invDate : new Date(invDate)) : fallback != null ? (fallback instanceof Date ? fallback : new Date(fallback)) : null
    if (!dateForMonth || Number.isNaN(dateForMonth.getTime())) continue

    const mk = monthKeyFromInvoiceDate(dateForMonth)
    monthSet.add(mk)

    const cid = r.customer_id.toString()
    const code = r.customers?.code?.trim() || ''
    const name = r.customers?.name?.trim() || ''

    let agg = byCustomer.get(cid)
    if (!agg) {
      agg = { code, name, byMonth: {}, rowTotal: 0 }
      byCustomer.set(cid, agg)
    }
    agg.byMonth[mk] = (agg.byMonth[mk] ?? 0) + bal
    agg.rowTotal += bal
    if (code && !agg.code) agg.code = code
    if (name && !agg.name) agg.name = name
  }

  const monthsArr = [...monthSet].sort(ymCompare)
  if (monthsArr.length === 0) {
    return { months: [], rows: [], columnTotals: {}, grandTotal: 0 }
  }

  const months = enumerateMonthsInclusive(monthsArr[0], monthsArr[monthsArr.length - 1])

  const rows: ReceivableSummaryRow[] = [...byCustomer.entries()]
    .map(([customerId, agg]) => {
      const byMonth: Record<string, number> = {}
      for (const m of months) {
        byMonth[m] = agg.byMonth[m] ?? 0
      }
      return {
        customerId,
        customerCode: agg.code || '—',
        customerName: agg.name || '—',
        byMonth,
        rowTotal: agg.rowTotal,
      }
    })
    .filter((row) => row.rowTotal > 0)
    .sort((a, b) => {
      const ca = a.customerCode.localeCompare(b.customerCode, 'zh-CN')
      if (ca !== 0) return ca
      return a.customerName.localeCompare(b.customerName, 'zh-CN')
    })

  const columnTotals: Record<string, number> = {}
  let grandTotal = 0
  for (const m of months) {
    let col = 0
    for (const row of rows) {
      col += row.byMonth[m] ?? 0
    }
    columnTotals[m] = col
    grandTotal += col
  }

  return { months, rows, columnTotals, grandTotal }
}
