/** 提柜管理列表排序（含 manual_sort_order；Prisma Client 未同步时可降级） */

import type { Prisma } from '@prisma/client'

export type PickupManagementOrderBy =
  | Prisma.pickup_managementOrderByWithRelationInput
  | Prisma.pickup_managementOrderByWithRelationInput[]

/** 自然视图的默认排序字段（拖拽顺序仅在此视图生效） */
const NATURAL_SORT_FIELD = 'created_at'

/** 主表字段（其余字段来自 orders 关联表） */
const MAIN_TABLE_FIELDS = [
  'pickup_id',
  'pickup_out',
  'report_empty',
  'return_empty',
  'notes',
  'current_location',
  'port_text',
  'shipping_line',
  'driver_id',
  'driver_name',
  'created_at',
  'updated_at',
]

/** 可空日期字段：排序时空值统一排在最后，避免顺序看起来杂乱 */
const NULLABLE_DATE_SORT_FIELDS = new Set([
  'order_date',
  'eta_date',
  'lfd_date',
  'pickup_date',
  'ready_date',
  'return_deadline',
  'appointment_time',
  'earliest_appointment_time',
  'updated_at',
])

function buildSortValue(
  field: string,
  order: 'asc' | 'desc'
): Prisma.SortOrder | Prisma.SortOrderInput {
  if (NULLABLE_DATE_SORT_FIELDS.has(field)) {
    return { sort: order, nulls: 'last' }
  }
  return order
}

export function buildPickupManagementOrderBy(
  searchParams: URLSearchParams,
  sort: string,
  order: 'asc' | 'desc',
  includeManualSort = true
): PickupManagementOrderBy {
  if (searchParams.get('pending_lfd_inquiry') === '1') {
    return [
      { orders: { eta_date: 'asc' } },
      { earliest_appointment_time: 'asc' },
    ]
  }

  if (searchParams.get('lfd_no_pickup') === '1') {
    return [
      { orders: { lfd_date: 'asc' } },
      { earliest_appointment_time: 'asc' },
    ]
  }

  // 拖拽顺序仅在默认（自然）视图生效；用户显式按列排序时不再以 manual_sort_order 为主键，
  // 否则任何排序（尤其是日期列）都会被拖拽顺序覆盖而看起来「没排序」。
  const isNaturalView = sort === NATURAL_SORT_FIELD
  const manualSortFirst =
    includeManualSort && isNaturalView
      ? [{ manual_sort_order: 'asc' as const }]
      : []

  // 稳定的兜底排序键，保证分页顺序确定
  const tieBreaker: Prisma.pickup_managementOrderByWithRelationInput = {
    pickup_id: 'desc',
  }

  if (sort === 'earliest_appointment_time') {
    return [
      ...manualSortFirst,
      { orders: { appointment_time: buildSortValue('appointment_time', order) } },
      tieBreaker,
    ]
  }
  if (MAIN_TABLE_FIELDS.includes(sort)) {
    if (sort === 'pickup_id') {
      return [...manualSortFirst, { pickup_id: order }]
    }
    return [...manualSortFirst, { [sort]: buildSortValue(sort, order) }, tieBreaker]
  }
  return [
    ...manualSortFirst,
    { orders: { [sort]: buildSortValue(sort, order) } },
    tieBreaker,
  ]
}

export function orderByUsesManualSort(orderBy: PickupManagementOrderBy | undefined): boolean {
  if (!orderBy) return false
  const list = Array.isArray(orderBy) ? orderBy : [orderBy]
  return list.some(
    (item) => item && typeof item === 'object' && 'manual_sort_order' in item
  )
}

export function stripManualSortFromOrderBy(
  orderBy: PickupManagementOrderBy | undefined
): PickupManagementOrderBy {
  if (!orderBy) return { created_at: 'desc' as const }
  if (Array.isArray(orderBy)) {
    const rest = orderBy.filter(
      (item) => !(item && typeof item === 'object' && 'manual_sort_order' in item)
    )
    if (rest.length === 0) return { created_at: 'desc' as const }
    if (rest.length === 1) return rest[0]
    return rest
  }
  if (typeof orderBy === 'object' && orderBy !== null && 'manual_sort_order' in orderBy) {
    return { created_at: 'desc' as const }
  }
  return orderBy
}
