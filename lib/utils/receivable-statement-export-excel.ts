/**
 * 应收 STATEMENT 风格 Excel（与同事整理模板一致：抬头 + Bill to + Account Summary + 明细表）
 */

import ExcelJS from 'exceljs'

/** 与示例模板一致的公司抬头（可按需改为环境变量） */
export const GG_STATEMENT_COMPANY = {
  name: 'G&G TRANSPORT INC',
  address: '851 81ST AVE STE H2 OAKLAND CA 94621',
  phone: '510-333-9737',
  email: 'accounting@ggtransport.in',
} as const

export type ReceivableStatementRow = {
  invoiceDate: Date | null
  containerNumber: string
  invoiceNumber: string
  amount: number
  payment: number
  balance: number
  customerCode?: string
  customerName?: string
}

function num(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'object' && v !== null && 'toNumber' in v) {
    return (v as { toNumber: () => number }).toNumber()
  }
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function formatUsDate(d: Date | null): string {
  if (!d || Number.isNaN(d.getTime())) return ''
  const m = d.getUTCMonth() + 1
  const day = d.getUTCDate()
  const y = d.getUTCFullYear()
  return `${m}/${day}/${y}`
}

export async function generateReceivableStatementExcel(input: {
  statementDate: Date
  billToLines: string[]
  customerIdLabel: string
  amountDue: number
  creditsLabel: string
  totalBalanceDue: number
  rows: ReceivableStatementRow[]
  /** 多于一个客户时增加「客户」列 */
  showCustomerColumn: boolean
}): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook()
  const sheet = wb.addWorksheet('STATEMENT', {
    views: [{ showGridLines: true }],
  })

  const tealFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0D9488' },
  }
  const whiteFont: Partial<ExcelJS.Font> = { color: { argb: 'FFFFFFFF' }, bold: true }
  const headerRowFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0D9488' },
  }
  const dataRowFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFF00' },
  }

  sheet.getColumn(1).width = 14
  sheet.getColumn(2).width = 18
  sheet.getColumn(3).width = 22
  sheet.getColumn(4).width = 14
  sheet.getColumn(5).width = 14
  sheet.getColumn(6).width = 14
  sheet.getColumn(7).width = 14
  sheet.getColumn(8).width = 6

  const r1 = sheet.getRow(1)
  r1.getCell(1).value = GG_STATEMENT_COMPANY.name
  r1.getCell(1).font = { bold: true, size: 14 }
  r1.getCell(6).value = 'STATEMENT'
  r1.getCell(6).font = { bold: true, size: 14 }

  sheet.getRow(2).getCell(1).value = GG_STATEMENT_COMPANY.address
  const sd = input.statementDate
  const sdStr = `${sd.getUTCMonth() + 1}/${sd.getUTCDate()}/${sd.getUTCFullYear()}`
  sheet.getRow(2).getCell(6).value = `Date: ${sdStr}`

  sheet.getRow(3).getCell(1).value = GG_STATEMENT_COMPANY.phone
  sheet.getRow(3).getCell(6).value = 'Statement #:'

  sheet.getRow(4).getCell(1).value = GG_STATEMENT_COMPANY.email
  sheet.getRow(4).getCell(6).value = `Customer ID: ${input.customerIdLabel || ''}`

  sheet.getRow(6).height = 22
  sheet.getCell('A6').value = 'Bill to:'
  sheet.getCell('A6').fill = tealFill
  sheet.getCell('A6').font = whiteFont as ExcelJS.Font
  sheet.mergeCells('A6:C6')

  sheet.getCell('E6').value = 'Account Summary:'
  sheet.getCell('E6').fill = tealFill
  sheet.getCell('E6').font = whiteFont as ExcelJS.Font
  sheet.mergeCells('E6:G6')

  const billLines = input.billToLines.length > 0 ? input.billToLines : ['']
  sheet.getRow(7).getCell(1).value = billLines[0] || ''
  sheet.getRow(7).getCell(1).font = { bold: true }
  sheet.getRow(7).getCell(5).value = 'Amount due:'
  sheet.getRow(7).getCell(6).value = num(input.amountDue)
  sheet.getRow(7).getCell(6).numFmt = '"$"#,##0.00'

  sheet.getRow(8).getCell(1).value = billLines[1] || ''
  sheet.getRow(8).getCell(5).value = 'credits:'
  sheet.getRow(8).getCell(6).value = input.creditsLabel || ''

  sheet.getRow(9).getCell(1).value = billLines[2] || ''
  sheet.getRow(9).getCell(5).value = 'Total balance due:'
  sheet.getRow(9).getCell(5).font = { bold: true }
  sheet.getRow(9).getCell(6).value = input.totalBalanceDue
  sheet.getRow(9).getCell(6).numFmt = '"$"#,##0.00'
  sheet.getRow(9).getCell(6).font = { bold: true }

  const headerRowIndex = 11
  const headers = input.showCustomerColumn
    ? ['DATE', 'CUSTOMER', 'Container#', 'INVOICE #', 'AMOUNT', 'PAYMENT', 'BALANCE']
    : ['DATE', 'Container#', 'INVOICE #', 'AMOUNT', 'PAYMENT', 'BALANCE']

  const hr = sheet.getRow(headerRowIndex)
  headers.forEach((h, i) => {
    const c = hr.getCell(i + 1)
    c.value = h
    c.fill = headerRowFill
    c.font = whiteFont as ExcelJS.Font
    c.alignment = { horizontal: 'center' }
  })

  let dataStart = headerRowIndex + 1
  for (const row of input.rows) {
    const dr = sheet.getRow(dataStart)
    let col = 1
    dr.getCell(col++).value = formatUsDate(row.invoiceDate)
    if (input.showCustomerColumn) {
      const cl = [row.customerCode, row.customerName].filter(Boolean).join(' ')
      dr.getCell(col++).value = cl || '—'
    }
    dr.getCell(col++).value = row.containerNumber || ''
    dr.getCell(col++).value = row.invoiceNumber || ''
    const amtCell = dr.getCell(col++)
    amtCell.value = row.amount
    amtCell.numFmt = '"$"#,##0.00'
    const payCell = dr.getCell(col++)
    payCell.value = row.payment
    payCell.numFmt = '"$"#,##0.00'
    const balCell = dr.getCell(col++)
    balCell.value = row.balance
    balCell.numFmt = '"$"#,##0.00'

    for (let c = 1; c < col; c++) {
      dr.getCell(c).fill = dataRowFill
    }
    dataStart++
  }

  return wb
}

export function mapReceivableDbRowToStatementRow(r: Record<string, unknown>): ReceivableStatementRow {
  const inv = r.invoices as Record<string, unknown> | undefined
  const ord = inv?.orders as Record<string, unknown> | undefined
  const cust = r.customers as Record<string, unknown> | undefined

  let invoiceDate: Date | null = null
  if (inv?.invoice_date) {
    const d = inv.invoice_date instanceof Date ? inv.invoice_date : new Date(String(inv.invoice_date))
    invoiceDate = Number.isNaN(d.getTime()) ? null : d
  }

  return {
    invoiceDate,
    containerNumber: ord?.order_number != null ? String(ord.order_number) : '',
    invoiceNumber: inv?.invoice_number != null ? String(inv.invoice_number) : '',
    amount: num(r.receivable_amount),
    payment: num(r.allocated_amount),
    balance: num(r.balance),
    customerCode: cust?.code != null ? String(cust.code) : '',
    customerName: cust?.name != null ? String(cust.name) : '',
  }
}
