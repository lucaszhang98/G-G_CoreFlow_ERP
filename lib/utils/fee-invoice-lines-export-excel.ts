/**
 * 费用核销明细（账单明细引用）导出为 Excel
 */

import ExcelJS from 'exceljs'
import type { FeeInvoiceLineUsageRow } from '@/lib/finance/fee-invoice-line-usage'
import {
  FEE_INVOICE_LINE_INVOICE_TYPE_LABEL,
  FEE_INVOICE_LINE_STATUS_LABEL,
} from '@/lib/finance/fee-invoice-line-usage'

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

export async function generateFeeInvoiceLinesExcel(input: {
  feeCode: string
  feeName: string
  rows: FeeInvoiceLineUsageRow[]
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const sheet = wb.addWorksheet('核销明细', { views: [{ showGridLines: true }] })

  sheet.mergeCells('A1:P1')
  const title = sheet.getCell('A1')
  title.value = `费用核销明细 — ${input.feeCode} ${input.feeName}`.trim()
  title.font = { bold: true, size: 12 }

  const headers = [
    '发票号',
    '发票日期',
    '账单类型',
    '发票状态',
    '客户编码',
    '客户名称',
    '订单号',
    '行费用编码',
    '行费用名称',
    '单位',
    '单价',
    '数量',
    '总价',
    '币种',
    '行备注',
    '明细创建时间',
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
      r.invoice_number,
      ymd(r.invoice_date),
      r.invoice_type
        ? FEE_INVOICE_LINE_INVOICE_TYPE_LABEL[r.invoice_type] ?? r.invoice_type
        : '',
      r.invoice_status
        ? FEE_INVOICE_LINE_STATUS_LABEL[r.invoice_status] ?? r.invoice_status
        : '',
      r.customer_code ?? '',
      r.customer_name ?? '',
      r.order_number ?? '',
      r.fee_code ?? '',
      r.fee_name ?? '',
      r.unit ?? '',
      dec(r.unit_price),
      dec(r.quantity),
      dec(r.total_amount),
      r.currency ?? 'USD',
      r.line_notes ?? '',
      r.created_at ? new Date(r.created_at).toISOString().slice(0, 19).replace('T', ' ') : '',
    ])
  }

  if (input.rows.length === 0) {
    sheet.addRow(['（暂无引用本费用的账单明细）'])
  }

  sheet.columns = [
    { width: 14 },
    { width: 12 },
    { width: 10 },
    { width: 10 },
    { width: 12 },
    { width: 18 },
    { width: 14 },
    { width: 12 },
    { width: 22 },
    { width: 8 },
    { width: 12 },
    { width: 10 },
    { width: 12 },
    { width: 8 },
    { width: 28 },
    { width: 20 },
  ]

  return Buffer.from(await wb.xlsx.writeBuffer())
}
