/**
 * 收款核销明细（payment_allocations）导出为 Excel
 */

import ExcelJS from 'exceljs'

const INVOICE_TYPE_LABEL: Record<string, string> = {
  direct_delivery: '直送',
  unload: '拆柜',
  penalty: '负数',
  storage: '仓储',
}

const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  audited: '已审核',
  issued: '已开票',
  void: '作废',
}

const RECEIVABLE_STATUS_LABEL: Record<string, string> = {
  open: '未结清',
  partial: '部分核销',
  closed: '已结清',
}

function dec(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'object' && v !== null && 'toString' in v) {
    return (v as { toString: () => string }).toString()
  }
  return String(v)
}

function ymd(d: Date | null): string {
  if (!d || Number.isNaN(new Date(d).getTime())) return ''
  const x = new Date(d)
  const y = x.getUTCFullYear()
  const m = String(x.getUTCMonth() + 1).padStart(2, '0')
  const day = String(x.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export type PaymentAllocationsExportRow = {
  allocation_id: string
  receivable_id: string
  invoice_number: string | null
  invoice_date: Date | null
  invoice_type: string | null
  invoice_status: string | null
  order_number: string | null
  customer_code: string | null
  customer_name: string | null
  receivable_amount: unknown
  receivable_allocated: unknown
  receivable_balance: unknown
  receivable_status: string | null
  due_date: Date | null
  allocated_amount: unknown
  created_at: Date | null
}

export type PaymentAllocationsExportHead = {
  payment_id: string
  payment_date: Date | null
  amount: unknown
  currency: string | null
  customer_code: string | null
  customer_name: string | null
}

export async function generatePaymentAllocationsExcel(input: {
  head: PaymentAllocationsExportHead
  rows: PaymentAllocationsExportRow[]
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const sheet = wb.addWorksheet('核销明细', { views: [{ showGridLines: true }] })

  sheet.mergeCells('A1:P1')
  const title = sheet.getCell('A1')
  const pd = ymd(input.head.payment_date)
  title.value =
    `收款核销明细 — 收款ID ${input.head.payment_id} | 收款日期 ${pd} | 金额 ${dec(input.head.amount)} ${input.head.currency ?? 'USD'} | 客户 ${input.head.customer_code ?? ''} ${input.head.customer_name ?? ''}`.trim()
  title.font = { bold: true, size: 12 }

  const headers = [
    '核销记录ID',
    '应收ID',
    '发票号',
    '发票日期',
    '账单类型',
    '发票状态',
    '订单号',
    '客户编码',
    '客户名称',
    '应收金额',
    '应收已核销',
    '应收余额',
    '应收状态',
    '应收到期日',
    '本笔核销金额',
    '核销创建时间',
  ]

  const headerRow = sheet.addRow(headers)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2E8F0' },
  }

  for (const r of input.rows) {
    sheet.addRow([
      r.allocation_id,
      r.receivable_id,
      r.invoice_number ?? '',
      ymd(r.invoice_date),
      r.invoice_type
        ? INVOICE_TYPE_LABEL[r.invoice_type] ?? r.invoice_type
        : '',
      r.invoice_status
        ? INVOICE_STATUS_LABEL[r.invoice_status] ?? r.invoice_status
        : '',
      r.order_number ?? '',
      r.customer_code ?? '',
      r.customer_name ?? '',
      dec(r.receivable_amount),
      dec(r.receivable_allocated),
      dec(r.receivable_balance),
      r.receivable_status
        ? RECEIVABLE_STATUS_LABEL[r.receivable_status] ?? r.receivable_status
        : '',
      ymd(r.due_date),
      dec(r.allocated_amount),
      r.created_at
        ? new Date(r.created_at).toISOString().slice(0, 19).replace('T', ' ')
        : '',
    ])
  }

  if (input.rows.length === 0) {
    sheet.addRow(['（暂无核销记录）'])
  }

  sheet.columns = [
    { width: 12 },
    { width: 12 },
    { width: 14 },
    { width: 12 },
    { width: 10 },
    { width: 10 },
    { width: 14 },
    { width: 12 },
    { width: 18 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 10 },
    { width: 12 },
    { width: 14 },
    { width: 20 },
  ]

  return Buffer.from(await wb.xlsx.writeBuffer())
}
