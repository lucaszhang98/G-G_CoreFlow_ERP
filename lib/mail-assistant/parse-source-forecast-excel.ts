import * as XLSX from 'xlsx'
import { normalizeHeaderCell } from '@/lib/mail-assistant/forecast-template-profile'
import { parseFlexibleDate } from '@/lib/mail-assistant/excel-date-serial'
import { normalizeContainerNumber } from '@/lib/mail-assistant/forecast-template-profile'

export type SourceForecastOrderHeader = {
  customerRaw: string
  operationModeRaw: string
  mbl: string
  orderNumber: string
  containerTypeRaw: string
  destinationRaw: string
  etaRaw: unknown
  orderDateRaw: unknown
}

export type SourceForecastDetailRow = {
  deliveryLocationRaw: string
  shippingMarkRaw: string
  quantity: number
  weight: number
  volume: number
  fba: string
  po: string
  deliveryNatureRaw: string
  windowPeriod: string
}

export type ParsedSourceForecast = {
  format: 'fixed_customer_template' | 'flexible_table'
  order: SourceForecastOrderHeader
  details: SourceForecastDetailRow[]
}

const DETAIL_COLUMN_ALIASES: Record<keyof Omit<SourceForecastDetailRow, 'quantity' | 'weight' | 'volume'>, string[]> = {
  deliveryLocationRaw: ['仓库代码', '送仓地点', '送仓', 'fc', 'fba仓', '目的地仓', 'location', '仓点'],
  shippingMarkRaw: ['唛头', '麦头', 'mark', 'shippingmark', '箱唛'],
  fba: ['fba'],
  po: ['po', '采购订单', '订单号po'],
  deliveryNatureRaw: ['派送方式', '性质', '类型', '送仓性质', 'detailtype'],
  windowPeriod: ['窗口期', 'po窗口期', 'window', '送仓窗口'],
}

const QUANTITY_ALIASES = ['箱数', '数量', '件数', 'qty', '板数']
const VOLUME_ALIASES = ['体积', '方数', 'cbm', 'volume']
const WEIGHT_ALIASES = ['重量', 'weight', 'kg']

const ORDER_LABEL_ALIASES: Record<keyof SourceForecastOrderHeader, string[]> = {
  customerRaw: ['客户名称', '客户', 'customer', '客户代码'],
  operationModeRaw: ['操作方式', '操作类型', 'mode'],
  mbl: ['mbl', '提单号', '主单号', '海运提单'],
  orderNumber: ['订单号', '柜号', '集装箱号', '箱号', 'container'],
  containerTypeRaw: ['货柜类型', '柜型', '箱型', 'container type'],
  destinationRaw: ['目的地', '目的港', 'destination'],
  etaRaw: ['eta', '预计到港', '到港日期', '预计到港时间'],
  orderDateRaw: ['订单日期', '预报日期', 'order date', '日期'],
}

function cellStr(value: unknown): string {
  return String(value ?? '').trim()
}

function parseNum(value: unknown): number {
  const n = parseFloat(String(value ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

function headerMatches(cell: unknown, aliases: string[], options?: { exactOnly?: boolean }): boolean {
  const norm = normalizeHeaderCell(cell)
  if (!norm) return false
  return aliases.some((a) => {
    const an = normalizeHeaderCell(a)
    if (options?.exactOnly) return norm === an
    return norm === an || norm.includes(an) || an.includes(norm)
  })
}

function isPoColumnHeader(cell: unknown): boolean {
  const norm = normalizeHeaderCell(cell)
  if (!norm) return false
  // 与 excel-transfer.ts 一致：精确识别 PO 列，且绝不把「PO窗口期」当 PO
  if (norm === 'po窗口期' || norm === '窗口期' || norm === '送仓窗口') return false
  return norm === 'po' || norm === '采购订单' || norm === '订单号po'
}

function mapDetailColumns(row: unknown[]): Record<string, number> {
  const colMap: Record<string, number> = {}
  row.forEach((cell, idx) => {
    if (headerMatches(cell, DETAIL_COLUMN_ALIASES.deliveryLocationRaw)) {
      colMap.deliveryLocationRaw = idx
    }
    if (headerMatches(cell, DETAIL_COLUMN_ALIASES.shippingMarkRaw)) {
      colMap.shippingMarkRaw = idx
    }
    if (headerMatches(cell, QUANTITY_ALIASES)) colMap.quantity = idx
    if (headerMatches(cell, VOLUME_ALIASES)) colMap.volume = idx
    if (headerMatches(cell, WEIGHT_ALIASES)) colMap.weight = idx
    if (headerMatches(cell, DETAIL_COLUMN_ALIASES.fba)) colMap.fba = idx
    if (isPoColumnHeader(cell)) colMap.po = idx
    if (headerMatches(cell, DETAIL_COLUMN_ALIASES.deliveryNatureRaw)) {
      colMap.deliveryNatureRaw = idx
    }
    if (headerMatches(cell, DETAIL_COLUMN_ALIASES.windowPeriod)) colMap.windowPeriod = idx
  })
  return colMap
}

function findDetailHeaderRow(rows: unknown[][]): { rowIndex: number; colMap: Record<string, number> } | null {
  let best: { rowIndex: number; colMap: Record<string, number>; score: number } | null = null

  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const row = rows[i] ?? []
    const colMap = mapDetailColumns(row)

    const score =
      (colMap.deliveryLocationRaw !== undefined ? 3 : 0) +
      (colMap.quantity !== undefined ? 2 : 0) +
      (colMap.volume !== undefined ? 2 : 0) +
      (colMap.deliveryNatureRaw !== undefined ? 1 : 0)

    if (score >= 5 && (!best || score > best.score)) {
      best = { rowIndex: i, colMap, score }
    }
  }

  return best ? { rowIndex: best.rowIndex, colMap: best.colMap } : null
}

function isFixedCustomerTemplate(rows: unknown[][]): boolean {
  const headerRow = rows[9] as unknown[] | undefined
  if (!headerRow) return false
  return headerRow.some((cell) => headerMatches(cell, DETAIL_COLUMN_ALIASES.deliveryLocationRaw))
}

function parseFixedCustomerTemplate(rows: unknown[][], containerNumber: string): ParsedSourceForecast {
  const getValue = (rowIndex: number, colIndex = 1): string => {
    const row = rows[rowIndex] as unknown[] | undefined
    return cellStr(row?.[colIndex])
  }

  const order: SourceForecastOrderHeader = {
    customerRaw: getValue(1),
    operationModeRaw: getValue(2),
    mbl: getValue(3),
    orderNumber: getValue(4) || containerNumber,
    containerTypeRaw: getValue(5),
    destinationRaw: getValue(6),
    etaRaw: (rows[7] as unknown[])?.[1] ?? '',
    orderDateRaw: getValue(1) ? getValue(0) : '', // 固定模板常在头部无单独订单日期，后面再兜底
  }

  const headerRowIndex = 9
  const headerRow = rows[headerRowIndex] as unknown[]
  const colMap = mapDetailColumns(headerRow)

  const labelPairs = extractLabelValuePairs(rows, headerRowIndex)
  if (labelPairs.orderDateRaw) order.orderDateRaw = labelPairs.orderDateRaw
  if (labelPairs.customerRaw && !order.customerRaw) order.customerRaw = labelPairs.customerRaw
  if (labelPairs.operationModeRaw && !order.operationModeRaw) {
    order.operationModeRaw = labelPairs.operationModeRaw
  }
  if (labelPairs.mbl && !order.mbl) order.mbl = labelPairs.mbl

  const details = readDetailRows(rows, headerRowIndex, colMap)
  return { format: 'fixed_customer_template', order, details }
}

function readDetailRows(
  rows: unknown[][],
  headerRowIndex: number,
  colMap: Record<string, number>
): SourceForecastDetailRow[] {
  const details: SourceForecastDetailRow[] = []
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i] ?? []
    const deliveryLocationRaw =
      colMap.deliveryLocationRaw !== undefined ? cellStr(row[colMap.deliveryLocationRaw]) : ''
    const shippingMarkRaw =
      colMap.shippingMarkRaw !== undefined ? cellStr(row[colMap.shippingMarkRaw]) : ''
    const deliveryNatureRaw =
      colMap.deliveryNatureRaw !== undefined ? cellStr(row[colMap.deliveryNatureRaw]) : ''

    // 自提/私仓行常见：仓库代码为空、唛头列有值（模版列顺序为 唛头→FBA→…→仓库代码）
    if (!deliveryLocationRaw && !shippingMarkRaw) continue

    details.push({
      deliveryLocationRaw: deliveryLocationRaw || shippingMarkRaw,
      shippingMarkRaw: shippingMarkRaw || deliveryLocationRaw,
      quantity: colMap.quantity !== undefined ? parseNum(row[colMap.quantity]) : 0,
      weight: colMap.weight !== undefined ? parseNum(row[colMap.weight]) : 0,
      volume: colMap.volume !== undefined ? parseNum(row[colMap.volume]) : 0,
      fba: colMap.fba !== undefined ? cellStr(row[colMap.fba]) : '',
      po: colMap.po !== undefined ? cellStr(row[colMap.po]) : '',
      deliveryNatureRaw,
      windowPeriod: colMap.windowPeriod !== undefined ? cellStr(row[colMap.windowPeriod]) : '',
    })
  }
  return details
}

function extractLabelValuePairs(rows: unknown[][], maxRows: number): Partial<SourceForecastOrderHeader> {
  const found: Partial<SourceForecastOrderHeader> = {}

  for (let r = 0; r < Math.min(rows.length, maxRows); r++) {
    const row = rows[r] ?? []
    for (let c = 0; c < Math.min(row.length, 12); c++) {
      const label = cellStr(row[c]).replace(/[：:]/g, '')
      const value = row[c + 1]
      for (const [field, aliases] of Object.entries(ORDER_LABEL_ALIASES) as Array<
        [keyof SourceForecastOrderHeader, string[]]
      >) {
        if (found[field] !== undefined && found[field] !== '') continue
        if (headerMatches(label, aliases)) {
          if (field === 'etaRaw' || field === 'orderDateRaw') {
            found[field] = value
          } else {
            found[field] = cellStr(value)
          }
        }
      }
    }
  }

  return found
}

function parseFlexibleTable(rows: unknown[][], containerNumber: string): ParsedSourceForecast | null {
  const header = findDetailHeaderRow(rows)
  if (!header) return null

  const pairs = extractLabelValuePairs(rows, header.rowIndex + 1)
  const order: SourceForecastOrderHeader = {
    customerRaw: pairs.customerRaw ?? '',
    operationModeRaw: pairs.operationModeRaw ?? '',
    mbl: pairs.mbl ?? '',
    orderNumber: pairs.orderNumber || containerNumber,
    containerTypeRaw: pairs.containerTypeRaw ?? '',
    destinationRaw: pairs.destinationRaw ?? '',
    etaRaw: pairs.etaRaw ?? '',
    orderDateRaw: pairs.orderDateRaw ?? '',
  }

  const details = readDetailRows(rows, header.rowIndex, header.colMap)
  if (details.length === 0) return null

  return { format: 'flexible_table', order, details }
}

export function parseSourceForecastExcel(
  buffer: Buffer,
  containerNumber: string
): ParsedSourceForecast {
  const cn = normalizeContainerNumber(containerNumber)
  // 不用 cellDates，避免 ETA 序列号被时区换算后差一天
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false })

  let best: ParsedSourceForecast | null = null

  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      defval: '',
    }) as unknown[][]

    if (!rows.length) continue

    let parsed: ParsedSourceForecast | null = null
    if (isFixedCustomerTemplate(rows)) {
      parsed = parseFixedCustomerTemplate(rows, cn)
    } else {
      parsed = parseFlexibleTable(rows, cn)
    }

    if (!parsed) continue
    if (!parsed.order.orderNumber) parsed.order.orderNumber = cn
    if (!best || parsed.details.length > best.details.length) best = parsed
  }

  if (!best) {
    return {
      format: 'flexible_table',
      order: {
        customerRaw: '',
        operationModeRaw: '',
        mbl: '',
        orderNumber: cn,
        containerTypeRaw: '',
        destinationRaw: '',
        etaRaw: '',
        orderDateRaw: '',
      },
      details: [],
    }
  }

  return best
}

/**
 * 是否为历史转换脚本（excel-transfer）同款客户填写模板输入格式：
 * 固定表头区 + 第 10 行明细表头含「仓库代码/送仓地点」且至少一行明细。
 */
export function isSourceForecastTemplateInputFormat(parsed: ParsedSourceForecast): boolean {
  return parsed.format === 'fixed_customer_template' && parsed.details.length > 0
}
