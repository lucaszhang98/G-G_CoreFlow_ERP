/**
 * 提柜管理统一日期筛选：前端三栏（字段 / 开始 / 结束）与 API 条件构建
 */

import type { EntityConfig } from '@/lib/crud/types'
import { pickupManagementConfig } from '@/lib/crud/configs/pickup-management'

export const PICKUP_DATE_FILTER_PARAM_FIELD = 'date_field'
export const PICKUP_DATE_FILTER_PARAM_FROM = 'date_from'
export const PICKUP_DATE_FILTER_PARAM_TO = 'date_to'

/** 提柜管理主表上的日期字段（其余在 orders 关联表） */
export const PICKUP_MAIN_TABLE_DATE_FIELDS = new Set(['earliest_appointment_time'])

export function getPickupDateFilterFieldOptions(
  config: EntityConfig = pickupManagementConfig
): Array<{ value: string; label: string }> {
  const columns = config.list.columns ?? []
  return columns
    .filter((key) => {
      const field = config.fields[key]
      return field && (field.type === 'date' || field.type === 'datetime')
    })
    .map((key) => ({ value: key, label: config.fields[key].label }))
}

/** 从 URL / filterValues 构建 Prisma 日期范围条件；字段非法或无范围时返回 null */
export function buildPickupUnifiedDateFilterCondition(
  searchParams: URLSearchParams
): Record<string, { gte?: Date; lte?: Date }> | null {
  const dateField = searchParams.get(`filter_${PICKUP_DATE_FILTER_PARAM_FIELD}`)
  const dateFrom = searchParams.get(`filter_${PICKUP_DATE_FILTER_PARAM_FROM}`)
  const dateTo = searchParams.get(`filter_${PICKUP_DATE_FILTER_PARAM_TO}`)

  if (!dateField || (!dateFrom && !dateTo)) return null

  const allowed = new Set(getPickupDateFilterFieldOptions().map((o) => o.value))
  if (!allowed.has(dateField)) return null

  const dateCondition: { gte?: Date; lte?: Date } = {}
  if (dateFrom) {
    dateCondition.gte = new Date(dateFrom)
  }
  if (dateTo) {
    const endDate = new Date(dateTo)
    endDate.setUTCHours(23, 59, 59, 999)
    dateCondition.lte = endDate
  }

  return { [dateField]: dateCondition }
}
