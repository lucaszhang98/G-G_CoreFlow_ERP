import { getSheetsClient } from '@/lib/google/workspace-oauth'
import { ordersWhereRootExcludeArchived } from '@/lib/orders/order-visibility'
import prisma from '@/lib/prisma'

export const OAK_SPREADSHEET_ID = '1JWeU4mT8nk86Pzfe-XNbhzMHdSoh1rPp6nubrbYxdBQ'
export const OAK_YG2025_SHEET_NAME = 'YG2025'

/** D 列柜号、J 列订单日期（1-based） */
const COL_CONTAINER = 3
const COL_ORDER_DATE = 9

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30)
const ORDER_DATE_CUTOFF_UTC = Date.UTC(2026, 3, 1) // 2026-04-01

export type Yg2025ImportRow = {
  containerNumber: string
  orderDate: string
  orderDateKey: string
  imported: boolean
}

export type Yg2025ImportCheckResult = {
  rows: Yg2025ImportRow[]
  total: number
  importedCount: number
  notImportedCount: number
  sheetName: string
  spreadsheetTitle: string
}

export function normalizeContainerNumber(value: string): string {
  return value.trim().toUpperCase()
}

export function parseSheetOrderDate(value: string | number | undefined | null): Date | null {
  if (value === undefined || value === null) return null
  if (typeof value === 'number') {
    if (value > 1000 && value < 100000) {
      return new Date(EXCEL_EPOCH_UTC + Math.floor(value) * 86400000)
    }
    return null
  }
  const s = String(value).trim()
  if (!s) return null

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) {
    return new Date(Date.UTC(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10)))
  }

  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (us) {
    return new Date(Date.UTC(parseInt(us[3], 10), parseInt(us[1], 10) - 1, parseInt(us[2], 10)))
  }

  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

export function toOrderDateKey(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatOrderDateUs(date: Date): string {
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  const y = date.getUTCFullYear()
  return `${m}/${d}/${y}`
}

/** 订单日期允许前后约两个月（60 天）的误差 */
export const ORDER_DATE_TOLERANCE_DAYS = 60

export function isOrderDateWithinTolerance(sheetDate: Date, systemDate: Date): boolean {
  const sheetUtc = Date.UTC(sheetDate.getUTCFullYear(), sheetDate.getUTCMonth(), sheetDate.getUTCDate())
  const systemUtc = Date.UTC(systemDate.getUTCFullYear(), systemDate.getUTCMonth(), systemDate.getUTCDate())
  const diffDays = Math.abs(sheetUtc - systemUtc) / 86400000
  return diffDays <= ORDER_DATE_TOLERANCE_DAYS
}

async function loadSystemOrdersByContainer(): Promise<Map<string, Date[]>> {
  const orders = await prisma.orders.findMany({
    where: ordersWhereRootExcludeArchived(),
    select: { order_number: true, order_date: true },
  })
  const map = new Map<string, Date[]>()
  for (const order of orders) {
    const key = normalizeContainerNumber(order.order_number ?? '')
    if (!key) continue
    const list = map.get(key) ?? []
    list.push(order.order_date)
    map.set(key, list)
  }
  return map
}

export function isSheetRowImported(
  containerNumber: string,
  sheetOrderDate: Date,
  systemOrdersByContainer: Map<string, Date[]>
): boolean {
  const key = normalizeContainerNumber(containerNumber)
  const systemDates = systemOrdersByContainer.get(key)
  if (!systemDates?.length) return false
  return systemDates.some((d) => isOrderDateWithinTolerance(sheetOrderDate, d))
}

export async function fetchYg2025ImportCheck(): Promise<Yg2025ImportCheckResult> {
  const sheets = await getSheetsClient()

  const meta = await sheets.spreadsheets.get({
    spreadsheetId: OAK_SPREADSHEET_ID,
    fields: 'properties.title',
  })
  const spreadsheetTitle = meta.data.properties?.title || 'OAK码头调度 LIS2024'

  const range = `'${OAK_YG2025_SHEET_NAME}'!A:J`
  const valuesRes = await sheets.spreadsheets.values.get({
    spreadsheetId: OAK_SPREADSHEET_ID,
    range,
    majorDimension: 'ROWS',
  })

  const allRows = valuesRes.data.values ?? []
  const [systemOrdersByContainer, parsedRows] = await Promise.all([
    loadSystemOrdersByContainer(),
    Promise.resolve(parseYg2025Rows(allRows)),
  ])

  const rows: Yg2025ImportRow[] = parsedRows.map((row) => ({
    containerNumber: row.containerNumber,
    orderDate: row.orderDateDisplay,
    orderDateKey: row.orderDateKey,
    imported: isSheetRowImported(row.containerNumber, row.orderDateUtc, systemOrdersByContainer),
  }))

  const importedCount = rows.filter((r) => r.imported).length

  return {
    rows,
    total: rows.length,
    importedCount,
    notImportedCount: rows.length - importedCount,
    sheetName: OAK_YG2025_SHEET_NAME,
    spreadsheetTitle,
  }
}

function parseYg2025Rows(allRows: string[][]): Array<{
  containerNumber: string
  orderDateKey: string
  orderDateDisplay: string
  orderDateUtc: Date
}> {
  const result: Array<{
    containerNumber: string
    orderDateKey: string
    orderDateDisplay: string
    orderDateUtc: Date
  }> = []

  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i]
    if (!row?.length) continue

    const containerRaw = String(row[COL_CONTAINER] ?? '').trim()
    if (!containerRaw) continue

    // 跳过表头行
    if (
      i === 0 &&
      (containerRaw === '柜号' || containerRaw.toLowerCase().includes('container'))
    ) {
      continue
    }

    const orderDateParsed = parseSheetOrderDate(row[COL_ORDER_DATE])
    if (!orderDateParsed) continue
    if (orderDateParsed.getTime() < ORDER_DATE_CUTOFF_UTC) continue

    result.push({
      containerNumber: containerRaw,
      orderDateKey: toOrderDateKey(orderDateParsed),
      orderDateDisplay: formatOrderDateUs(orderDateParsed),
      orderDateUtc: orderDateParsed,
    })
  }

  return result
}
