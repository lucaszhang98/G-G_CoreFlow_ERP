import { normalizeHeaderCell } from '@/lib/mail-assistant/forecast-template-profile'

export type ForecastDetailColMap = Record<string, number>

const DETAIL_COLUMN_ALIASES = {
  deliveryLocationRaw: ['仓库代码', '送仓地点', '送仓', 'fc', 'fba仓', '目的地仓', 'location', '仓点'],
  shippingMarkRaw: ['唛头', '麦头', 'mark', 'shippingmark', '箱唛'],
  fba: ['fba'],
  po: ['po', '采购订单', '订单号po'],
  deliveryNatureRaw: ['派送方式', '性质', '类型', '送仓性质', 'detailtype'],
  windowPeriod: ['窗口期', 'po窗口期', 'window', '送仓窗口'],
} as const

const QUANTITY_ALIASES = ['箱数', '数量', '件数', 'qty', '板数']
const VOLUME_ALIASES = ['体积', '方数', 'cbm', 'volume']
const WEIGHT_ALIASES = ['重量', 'weight', 'kg']

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
  if (norm === 'po窗口期' || norm === '窗口期' || norm === '送仓窗口') return false
  return norm === 'po' || norm === '采购订单' || norm === '订单号po'
}

export function mapForecastDetailColumns(row: unknown[]): ForecastDetailColMap {
  const colMap: ForecastDetailColMap = {}
  row.forEach((cell, idx) => {
    if (headerMatches(cell, [...DETAIL_COLUMN_ALIASES.deliveryLocationRaw])) {
      colMap.deliveryLocationRaw = idx
    }
    if (headerMatches(cell, [...DETAIL_COLUMN_ALIASES.shippingMarkRaw])) {
      colMap.shippingMarkRaw = idx
    }
    if (headerMatches(cell, QUANTITY_ALIASES)) colMap.quantity = idx
    if (headerMatches(cell, VOLUME_ALIASES)) colMap.volume = idx
    if (headerMatches(cell, WEIGHT_ALIASES)) colMap.weight = idx
    if (headerMatches(cell, [...DETAIL_COLUMN_ALIASES.fba])) colMap.fba = idx
    if (isPoColumnHeader(cell)) colMap.po = idx
    if (headerMatches(cell, [...DETAIL_COLUMN_ALIASES.deliveryNatureRaw])) {
      colMap.deliveryNatureRaw = idx
    }
    if (headerMatches(cell, [...DETAIL_COLUMN_ALIASES.windowPeriod])) colMap.windowPeriod = idx
  })
  return colMap
}

function isFixedCustomerTemplateHeaderRow(row: unknown[] | undefined): boolean {
  if (!row) return false
  return row.some((cell) => headerMatches(cell, [...DETAIL_COLUMN_ALIASES.deliveryLocationRaw]))
}

export function findForecastDetailHeader(
  rows: unknown[][]
): { rowIndex: number; colMap: ForecastDetailColMap } | null {
  if (isFixedCustomerTemplateHeaderRow(rows[9] as unknown[] | undefined)) {
    return { rowIndex: 9, colMap: mapForecastDetailColumns(rows[9] ?? []) }
  }

  let best: { rowIndex: number; colMap: ForecastDetailColMap; score: number } | null = null

  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const row = rows[i] ?? []
    const colMap = mapForecastDetailColumns(row)

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
