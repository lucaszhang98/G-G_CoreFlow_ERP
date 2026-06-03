/**
 * 入库管理列表查询（与 GET /api/wms/inbound-receipts 同源），供列表分页与导出复用。
 */
import prisma from '@/lib/prisma'
import { serializeBigInt } from '@/lib/api/helpers'
import { buildFilterConditions, mergeFilterConditions } from '@/lib/crud/filter-helper'
import { enhanceConfigWithSearchFields } from '@/lib/crud/search-config-generator'
import { resolveOrderFistFromRelation } from '@/lib/wms/resolve-order-fist-display'
import { resolveInboundDisplayStatus } from '@/lib/wms/current-location-blocks-unload'
import { prismaAppointmentDetailLinesWhereParentAppointmentActive } from '@/lib/utils/delivery-appointment-enabled'
import { computeInboundReceiptHeaderDeliveryProgress } from '@/lib/utils/inbound-delivery-progress'
import {
  applyArchivedFilterToInboundReceiptWhere,
  parseIncludeArchived,
} from '@/lib/orders/order-visibility'
import { inboundReceiptConfig } from '@/lib/crud/configs/inbound-receipts'

export type InboundReceiptListQueryMode =
  | { type: 'paged'; page: number; limit: number; sort: string; order: 'asc' | 'desc' }
  | { type: 'export'; maxRows?: number }

export type InboundReceiptListQueryResult = {
  data: any[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

const DEFAULT_EXPORT_MAX = 50_000

function plannedUnloadTime(row: any): number {
  const v = row?.planned_unload_at
  if (v == null || v === '') return Number.POSITIVE_INFINITY
  const t = new Date(v).getTime()
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY
}

/** 导出：按拆柜日期升序，未填日期的行排在最后 */
function sortExportByPlannedUnloadAsc(rows: any[]) {
  return [...rows].sort((a, b) => plannedUnloadTime(a) - plannedUnloadTime(b))
}

export async function runInboundReceiptListQuery(
  searchParams: URLSearchParams,
  mode: InboundReceiptListQueryMode
): Promise<InboundReceiptListQueryResult> {
  const isExport = mode.type === 'export'
  const page = isExport ? 1 : Math.max(1, mode.page)
  const limit = isExport ? 1 : Math.min(100, Math.max(1, mode.limit))
  const sort = isExport ? 'planned_unload_at' : mode.sort || 'created_at'
  const order: 'asc' | 'desc' = isExport ? 'asc' : mode.order
  const search = searchParams.get('search') || ''

  const enhancedConfig = enhanceConfigWithSearchFields(inboundReceiptConfig)

  const where: any = {
    orders: {
      operation_mode: 'unload',
    },
  }

  const filterConditions = buildFilterConditions(enhancedConfig, searchParams)

  const mainTableFilterFields = [
    'inbound_receipt_id',
    'order_id',
    'status',
    'planned_unload_at',
    'unloaded_by',
    'received_by',
    'notes',
    'is_urgent',
    'is_changed',
  ]
  const mainTableConditions: any[] = []
  const ordersConditions: any = {}

  const isMainTableCondition = (cond: any): boolean => {
    if (!cond || typeof cond !== 'object') return false
    const keys = Object.keys(cond)
    if (keys.length === 1 && keys[0] === 'OR' && Array.isArray(cond.OR) && cond.OR.length > 0) {
      const first = cond.OR[0]
      if (first && typeof first === 'object') {
        const innerKeys = Object.keys(first)
        const innerKey = innerKeys[0]
        return innerKey != null && mainTableFilterFields.includes(innerKey)
      }
      return false
    }
    return keys.some((k) => mainTableFilterFields.includes(k))
  }

  const hasDeliveryProgress = (obj: any): boolean => {
    if (!obj || typeof obj !== 'object') return false
    if ('delivery_progress' in obj) return true
    return Object.values(obj).some((v) => hasDeliveryProgress(v))
  }

  filterConditions.forEach((condition) => {
    if (hasDeliveryProgress(condition)) return
    if (isMainTableCondition(condition)) {
      mainTableConditions.push(condition)
    } else {
      Object.assign(ordersConditions, condition)
    }
  })

  const filterDeliveryProgress = searchParams.get('filter_delivery_progress')
  const filterByDeliveryProgress =
    filterDeliveryProgress === 'complete' || filterDeliveryProgress === 'incomplete'

  if (mainTableConditions.length > 0) {
    mergeFilterConditions(where, mainTableConditions)
  }

  const plannedFrom = searchParams.get('filter_planned_unload_at_from')
  const plannedTo = searchParams.get('filter_planned_unload_at_to')
  if (plannedFrom && !plannedTo && where.planned_unload_at?.gte && where.planned_unload_at?.lte === undefined) {
    const gte = where.planned_unload_at.gte
    where.AND = where.AND || []
    where.AND.push({
      OR: [{ planned_unload_at: { gte } }, { planned_unload_at: null }],
    })
    delete where.planned_unload_at
  }

  if (Object.keys(ordersConditions).length > 0) {
    if (where.orders) {
      where.orders = {
        ...where.orders,
        ...ordersConditions,
      }
    } else {
      where.orders = ordersConditions
    }
  }

  if (searchParams.get('filter_released_containers') === '1') {
    const today = new Date()
    const startOfTomorrow = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1)
    )
    where.AND = where.AND || []
    where.AND.push({ planned_unload_at: { gte: startOfTomorrow } })
    where.orders = {
      ...where.orders,
      operation_mode: 'unload',
      pickup_date: { not: null },
    }
  }

  if (search && search.trim()) {
    const searchConditions: any[] = []
    searchConditions.push({
      orders: {
        operation_mode: 'unload',
        order_number: { contains: search, mode: 'insensitive' },
      },
    })
    searchConditions.push({
      orders: {
        operation_mode: 'unload',
        customers: { name: { contains: search, mode: 'insensitive' } },
      },
    })
    if (searchConditions.length > 0) {
      where.OR = searchConditions
    }
  }

  if (!where.OR && !where.orders) {
    where.orders = {
      operation_mode: 'unload',
    }
  }

  let orderBy: any = {}
  const mainTableFields = [
    'inbound_receipt_id',
    'status',
    'arrived_at_warehouse',
    'is_urgent',
    'is_changed',
    'planned_unload_at',
    'unloaded_by',
    'received_by',
    'notes',
    'created_at',
    'updated_at',
    'delivery_progress',
  ]

  if (sort === 'container_number') {
    orderBy = { orders: { order_number: order } }
  } else if (sort === 'carrier') {
    orderBy = { orders: { carriers: { name: order } } }
  } else if (sort === 'warehouse_point_count') {
    orderBy = [
      { orders: { order_detail: { _count: order } } },
      { inbound_receipt_id: 'desc' },
    ]
  } else if (sort === 'delivery_progress') {
    orderBy = { inbound_receipt_id: 'desc' }
  } else if (mainTableFields.includes(sort)) {
    orderBy = { [sort]: order }
  } else {
    orderBy = {
      orders: {
        [sort]: order,
      },
    }
  }

  const sortByDeliveryProgress = sort === 'delivery_progress'
  const wideFetchForDelivery = sortByDeliveryProgress || filterByDeliveryProgress
  const exportMax = isExport ? Math.min(mode.maxRows ?? DEFAULT_EXPORT_MAX, DEFAULT_EXPORT_MAX) : 0
  const skip = wideFetchForDelivery || isExport ? 0 : (page - 1) * limit
  const take = isExport ? exportMax : wideFetchForDelivery ? 50000 : limit

  let items: any[]
  let total: number

  const includeConfig: any = {
    orders: {
      select: {
        order_id: true,
        order_number: true,
        order_date: true,
        eta_date: true,
        ready_date: true,
        lfd_date: true,
        pickup_date: true,
        fist: true,
        carrier_id: true,
        customers: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        carriers: {
          select: {
            carrier_id: true,
            name: true,
            carrier_code: true,
          },
        },
        pickup_management: {
          select: { current_location: true },
        },
        order_detail: {
          select: {
            id: true,
            estimated_pallets: true,
            appointment_detail_lines: {
              where: prismaAppointmentDetailLinesWhereParentAppointmentActive,
              select: {
                estimated_pallets: true,
                rejected_pallets: true,
                delivery_appointments: {
                  select: {
                    confirmed_start: true,
                  },
                },
              },
            },
          },
        },
      },
    },
    warehouses: {
      select: {
        warehouse_id: true,
        name: true,
        warehouse_code: true,
      },
    },
    unload_methods: {
      select: {
        method_code: true,
        description: true,
      },
    },
    inventory_lots: {
      select: {
        order_detail_id: true,
        pallet_count: true,
        remaining_pallet_count: true,
        unbooked_pallet_count: true,
        pallet_counts_verified: true,
        storage_location_code: true,
      },
    },
  }

  try {
    includeConfig.users_inbound_receipt_received_byTousers = {
      select: {
        id: true,
        full_name: true,
        username: true,
      },
    }
    includeConfig.users_inbound_receipt_unloaded_byTousers = {
      select: {
        id: true,
        full_name: true,
        username: true,
      },
    }
  } catch {
    // ignore
  }

  if (!prisma.inbound_receipt) {
    throw new Error('Prisma 客户端未找到 inbound_receipt 模型，请运行 npx prisma generate')
  }

  applyArchivedFilterToInboundReceiptWhere(where, parseIncludeArchived(searchParams))

  const queryOptions: any = {
    where,
    orderBy,
    skip,
    take,
    include: includeConfig,
  }

  try {
    ;[items, total] = await Promise.all([
      prisma.inbound_receipt.findMany(queryOptions),
      prisma.inbound_receipt.count({ where }),
    ])
  } catch (queryError: any) {
    if (queryError.message?.includes('Unknown field') || queryError.message?.includes('users_inbound_receipt')) {
      const simplifiedInclude = { ...includeConfig }
      delete simplifiedInclude.users_inbound_receipt_received_byTousers
      delete simplifiedInclude.users_inbound_receipt_unloaded_byTousers
      queryOptions.include = simplifiedInclude
      ;[items, total] = await Promise.all([
        prisma.inbound_receipt.findMany(queryOptions),
        prisma.inbound_receipt.count({ where }),
      ])
    } else {
      throw queryError
    }
  }

  const serializedItems = items.map((item: any) => {
    try {
      const serialized = serializeBigInt(item)
      const order = serialized.orders
      let customerName = null
      if (order && order.customers) {
        customerName = order.customers.name || null
      }
      const containerNumber = order?.order_number || null
      const inventoryLots = serialized.inventory_lots || []
      const orderDetails = order?.order_detail || []
      const calculatedDeliveryProgress = computeInboundReceiptHeaderDeliveryProgress({
        orderDetails,
        inventoryLots,
      })
      const warehousePointCount = Array.isArray(orderDetails) ? orderDetails.length : 0
      const currentLocation = order?.pickup_management?.current_location ?? null
      // is_changed 仅用于柜号绿色展示；状态以库内值为准，便于「已变更」后继续编辑状态
      const displayStatus = resolveInboundDisplayStatus(currentLocation, serialized.status)

      return {
        ...serialized,
        status: serialized.status,
        display_status: displayStatus,
        customer_name: customerName,
        fist: resolveOrderFistFromRelation(order),
        container_number: containerNumber,
        warehouse_point_count: warehousePointCount,
        order_date: order?.order_date || null,
        eta_date: order?.eta_date || null,
        ready_date: order?.ready_date || null,
        lfd_date: order?.lfd_date || null,
        pickup_date: order?.pickup_date || null,
        planned_unload_at: serialized.planned_unload_at,
        carrier: order?.carriers || null,
        carrier_id: order?.carrier_id ? String(order.carrier_id) : null,
        unloaded_by: serialized.unloaded_by || null,
        received_by: serialized.received_by || null,
        users_inbound_receipt_unloaded_byTousers: serialized.users_inbound_receipt_unloaded_byTousers || null,
        users_inbound_receipt_received_byTousers: serialized.users_inbound_receipt_received_byTousers || null,
        warehouse_name: serialized.warehouses?.name || null,
        unload_method_name: serialized.unload_methods?.description || null,
        delivery_progress: calculatedDeliveryProgress,
        order_id: order?.order_id || serialized.order_id || null,
        current_location: currentLocation,
      }
    } catch (itemError: any) {
      console.error('序列化数据项失败:', itemError, item)
      return {
        ...serializeBigInt(item),
        customer_name: null,
        fist: false,
        container_number: null,
        order_date: null,
        eta_date: null,
        ready_date: null,
        lfd_date: null,
        pickup_date: null,
        received_by: null,
        received_by_id: null,
        warehouse_name: null,
        unload_method_name: null,
        delivery_progress: 0,
        warehouse_point_count: 0,
      }
    }
  })

  let resultItems = serializedItems
  if (filterByDeliveryProgress) {
    if (filterDeliveryProgress === 'complete') {
      resultItems = resultItems.filter((a: any) => Number(a.delivery_progress) >= 100)
    } else {
      resultItems = resultItems.filter((a: any) => Number(a.delivery_progress) < 100)
    }
  }

  let totalForPagination = total
  if (filterByDeliveryProgress) {
    totalForPagination = resultItems.length
  }

  if (sortByDeliveryProgress && resultItems.length > 0) {
    const dir = order === 'asc' ? 1 : -1
    resultItems = [...resultItems].sort((a: any, b: any) => {
      const va = a.delivery_progress != null ? Number(a.delivery_progress) : 0
      const vb = b.delivery_progress != null ? Number(b.delivery_progress) : 0
      return (va - vb) * dir
    })
  }

  if (isExport) {
    resultItems = sortExportByPlannedUnloadAsc(resultItems)
    const n = resultItems.length
    return {
      data: resultItems,
      pagination: {
        page: 1,
        limit: n,
        total: n,
        totalPages: 1,
      },
    }
  }

  if (wideFetchForDelivery) {
    resultItems = resultItems.slice((page - 1) * limit, page * limit)
  }

  return {
    data: resultItems,
    pagination: {
      page,
      limit,
      total: totalForPagination,
      totalPages: Math.ceil(totalForPagination / limit),
    },
  }
}
