import {
  fetchYg2025ImportCheck,
  normalizeContainerNumber,
  parseSheetOrderDate,
  toOrderDateKey,
} from '@/lib/google/oak-yg2025-sheet'
import { dateToExcelSerial } from '@/lib/mail-assistant/excel-date-serial'

export type Yg2025DateIndex = {
  /** container|orderDateKey → orderDateKey */
  byContainerAndKey: Map<string, string>
  /** container → 所有 orderDateKey（可能重复柜号） */
  byContainer: Map<string, string[]>
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

/** 从 YG2025 构建柜号 + 订单日期索引（与邮件助手清单一致） */
export async function loadYg2025DateIndex(): Promise<Yg2025DateIndex> {
  const yg = await fetchYg2025ImportCheck()
  const byContainerAndKey = new Map<string, string>()
  const byContainer = new Map<string, string[]>()

  for (const row of yg.rows) {
    const cn = normalizeContainerNumber(row.containerNumber)
    const key = row.orderDateKey
    byContainerAndKey.set(mailAssistantRowKey(cn, key), key)
    const list = byContainer.get(cn) ?? []
    if (!list.includes(key)) list.push(key)
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
  if (keys.length === 1) return keys[0]
  return null
}

export function formatOrderDateKeyForWarning(orderDateKey: string): string {
  const d = orderDateKeyToUtcDate(orderDateKey)
  if (!d) return orderDateKey
  return toOrderDateKey(d)
}
