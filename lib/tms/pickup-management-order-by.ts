/** 提柜管理列表排序（含 manual_sort_order；Prisma Client 未同步时可降级） */

import type { Prisma } from '@prisma/client'

export type PickupManagementOrderBy =
  | Prisma.pickup_managementOrderByWithRelationInput
  | Prisma.pickup_managementOrderByWithRelationInput[]

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

  const manualSortFirst = includeManualSort ? [{ manual_sort_order: 'asc' as const }] : []
  const mainTableFields = [
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

  if (sort === 'earliest_appointment_time') {
    return [...manualSortFirst, { orders: { appointment_time: order } }]
  }
  if (mainTableFields.includes(sort)) {
    return [...manualSortFirst, { [sort]: order }]
  }
  return [...manualSortFirst, { orders: { [sort]: order } }]
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
