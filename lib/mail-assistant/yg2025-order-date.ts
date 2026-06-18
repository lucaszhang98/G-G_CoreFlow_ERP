import {
  fetchYg2025ImportCheck,
  normalizeContainerNumber,
  parseSheetOrderDate,
  toOrderDateKey,
} from '@/lib/google/oak-yg2025-sheet'
import { dateToExcelSerial } from '@/lib/mail-assistant/excel-date-serial'

export type Yg2025RowRef = {
  orderDateKey: string
  customerCode: string | null
}

export type Yg2025DateIndex = {
  /** container|orderDateKey → 码头表行 */
  byContainerAndKey: Map<string, Yg2025RowRef>
  /** container → 所有码头表行（可能重复柜号） */
  byContainer: Map<string, Yg2025RowRef[]>
}

export function mailAssistantRowKey(containerNumber: string, orderDateKey: string): string {
  return `${normalizeContainerNumber(containerNumber)}|${orderDateKey}`
}

export function orderDateKeyToUtcDate(orderDateKey: string): Date | null {
  return parseSheetOrderDate(orderDateKey)
}

export function orderDateKeyToExcelSerial(orderDateKey: string): number | null {
  const d = orderDateKeyToUtcDate(orderDateKey)
  if (!d) return null
  return dateToExcelSerial(
    new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  )
}

/** 从 YG2025 构建柜号 + 订单日期 + 客户索引（与邮件助手清单一致） */
export async function loadYg2025DateIndex(): Promise<Yg2025DateIndex> {
  const yg = await fetchYg2025ImportCheck()
  const byContainerAndKey = new Map<string, Yg2025RowRef>()
  const byContainer = new Map<string, Yg2025RowRef[]>()

  for (const row of yg.rows) {
    const cn = normalizeContainerNumber(row.containerNumber)
    const ref: Yg2025RowRef = {
      orderDateKey: row.orderDateKey,
      customerCode: row.customerCode,
    }
    byContainerAndKey.set(mailAssistantRowKey(cn, row.orderDateKey), ref)
    const list = byContainer.get(cn) ?? []
    if (!list.some((r) => r.orderDateKey === ref.orderDateKey)) list.push(ref)
    byContainer.set(cn, list)
  }

  return { byContainerAndKey, byContainer }
}

/** 仅有唯一码头表行时按柜号解析；否则须显式传入 orderDateKey */
export function resolveYg2025OrderDateKey(
  index: Yg2025DateIndex,
  containerNumber: string,
  orderDateKey?: string | null
): string | null {
  const cn = normalizeContainerNumber(containerNumber)
  if (orderDateKey?.trim()) {
    const k = orderDateKey.trim()
    if (index.byContainerAndKey.has(mailAssistantRowKey(cn, k))) return k
    return k
  }
  const keys = index.byContainer.get(cn) ?? []
  if (keys.length === 1) return keys[0].orderDateKey
  return null
}

/** 邮件助手明细行客户代码：显式传入优先，否则按柜号+订单日期查码头表 */
export function resolveYg2025CustomerCode(
  index: Yg2025DateIndex,
  containerNumber: string,
  orderDateKey?: string | null,
  explicitCustomerCode?: string | null
): string | null {
  const explicit = explicitCustomerCode?.trim()
  if (explicit) return explicit

  const cn = normalizeContainerNumber(containerNumber)
  if (orderDateKey?.trim()) {
    const ref = index.byContainerAndKey.get(mailAssistantRowKey(cn, orderDateKey.trim()))
    return ref?.customerCode ?? null
  }
  const rows = index.byContainer.get(cn) ?? []
  if (rows.length === 1) return rows[0].customerCode ?? null
  return null
}

export function formatOrderDateKeyForWarning(orderDateKey: string): string {
  const d = orderDateKeyToUtcDate(orderDateKey)
  if (!d) return orderDateKey
  return toOrderDateKey(d)
}
