import { NextRequest, NextResponse } from 'next/server'
import { checkAuth, serializeBigInt } from '@/lib/api/helpers'
import prisma from '@/lib/prisma'
import { prismaAppointmentDetailLinesWhereParentAppointmentActive } from '@/lib/utils/delivery-appointment-enabled'
import {
  computeInboundOrderDetailDeliveryState,
  resolveAppointmentsFromOrderDetail,
} from '@/lib/utils/inbound-delivery-progress'
import {
  mergeOrdersRelationExcludeArchived,
  parseIncludeArchived,
} from '@/lib/orders/order-visibility'
import { findOrderDetailIdsByBookingStatus } from '@/lib/orders/order-detail-booking-status-filter'
import {
  findOrderDetailIdsByEarliestAppointmentTime,
  intersectOrderDetailIdFilter,
} from '@/lib/orders/order-detail-earliest-appointment-filter'
import { computeOrderDetailUnbookedPallets } from '@/lib/orders/order-detail-unbooked-pallets'
import { resolveOrderFistFromRelation } from '@/lib/wms/resolve-order-fist-display'

/** 列表展示所需订单字段；显式 select，避免 include 全表 scalar 在迁移未部署时拖垮列表 */
const orderDetailsOrdersSelect = {
  order_number: true,
  operation_mode: true,
  pickup_date: true,
  fist: true,
  customers: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
  pickup_management: {
    select: {
      current_location: true,
    },
  },
  inbound_receipt: {
    select: {
      inbound_receipt_id: true,
      planned_unload_at: true,
      status: true,
    },
  },
} as const

/**
 * GET /api/oms/order-details
 * 获取所有订单明细（已入库 + 未入库）
 * 
 * 查询参数：
 * - page: 页码（默认1）
 * - limit: 每页数量（默认100，最大100）
 * - sort: 排序字段（默认 id；storage_location_code 在服务端对全量结果内存排序）
 * - order: 排序方向（asc/desc，默认desc）
 * - search: 搜索关键词（柜号/订单号、私仓信息，模糊匹配）
 * - filter_customer_name: 客户筛选
 * - filter_operation_mode: 操作方式筛选（direct_delivery 直送 / unload 拆柜）
 * - filter_delivery_nature: 送仓性质筛选
 * - filter_delivery_location_code: 仓点筛选
 * - filter_booking_status: 预约状态筛选（unbooked/fully_booked/overbooked）
 * - filter_planned_unload_at_from/to: 预计拆柜日期范围筛选
 * - filter_pickup_date_from/to: 提柜时间范围筛选（订单级，按 UTC 日历日，精确到日）
 * - filter_earliest_appointment_time_from/to: 最早预约时间范围（计算字段，先全量算 id 再分页）
 * - filter_inbound_receipt_status_scope: received=仅关联入库单状态为已入库；__all__ 或不传=不按入库状态限制
 * 
 * 特殊说明：
 * - 未约/剩余/送货进度：已入库与入库详情一致（预约实时计算）；未入库用预计板数-预约板数之和算未约
 * - 未约板数允许负数（表示多约，会用红色显示）
 * - 预约状态、最早预约时间、按仓库位置排序均在完整 where 下全量处理，不设抽样上限
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '100', 10)))
    const sort = searchParams.get('sort') || 'id'
    const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc'
    const search = searchParams.get('search') || ''
    const includeArchived = parseIncludeArchived(searchParams)

    /** 历史：列表内联实际板数；现改为剩余板数草稿保存。保留默认仓库供其它流程创建批次 */
    const defaultWarehouse = await prisma.warehouses.findFirst({
      orderBy: { warehouse_id: 'asc' },
      select: { warehouse_id: true },
    })
    const defaultWarehouseIdStr =
      defaultWarehouse?.warehouse_id != null ? String(defaultWarehouse.warehouse_id) : null

    // 构建查询条件
    const where: any = {
      // 不筛选已入库，显示所有订单明细
    }

    // 按 id 列表筛选（用于新建预约时拉取勾选的明细）
    const idsParam = searchParams.get('ids')
    if (idsParam && idsParam.trim()) {
      try {
        const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean).map((s) => BigInt(s))
        if (ids.length > 0) {
          where.id = { in: ids }
        }
      } catch {
        // 忽略无效 ids
      }
    }

    // 模糊搜索：柜号（订单号）、私仓信息
    if (search && search.trim()) {
      const searchTrim = search.trim()
      const searchClause = {
        OR: [
          {
            orders: {
              order_number: { contains: searchTrim, mode: 'insensitive' as const },
            },
          },
          {
            private_warehouse_info: { contains: searchTrim, mode: 'insensitive' as const },
          },
        ],
      }
      if (where.AND) {
        if (!Array.isArray(where.AND)) {
          where.AND = [where.AND, searchClause]
        } else {
          where.AND.push(searchClause)
        }
      } else {
        where.AND = [searchClause]
      }
    }

    // 筛选条件
    // 客户筛选
    const customer_name = searchParams.get('filter_customer_name')
    if (customer_name && customer_name !== '__all__') {
      where.orders = {
        ...where.orders,
        customers: {
          id: BigInt(customer_name),
        },
      }
    }

    const delivery_nature = searchParams.get('filter_delivery_nature')
    if (delivery_nature && delivery_nature !== '__all__') {
      where.delivery_nature = delivery_nature
    }

    const delivery_location = searchParams.get('filter_delivery_location_code')
    if (delivery_location && delivery_location !== '__all__') {
      // 通过关联的 locations 表筛选 location_id
      // 注意：前端传的是 location_id（因为配置中 valueField 是 location_id）
      where.locations_order_detail_delivery_location_idTolocations = {
        location_id: BigInt(delivery_location),
      }
    }

    // 操作方式筛选（直送 direct_delivery / 拆柜 unload）
    const filter_operation_mode = searchParams.get('filter_operation_mode')
    if (filter_operation_mode && filter_operation_mode !== '__all__') {
      where.orders = {
        ...where.orders,
        operation_mode: filter_operation_mode,
      }
    }

    const filter_fist = searchParams.get('filter_fist')
    if (filter_fist && filter_fist !== '__all__') {
      where.orders = {
        ...where.orders,
        fist: filter_fist === 'true',
      }
    }

    // 预约状态筛选（由于未约板数是实时计算的，需要在查询后筛选）
    // 先不在这里处理，在查询后根据计算出的未约板数筛选
    const booking_status_filter = searchParams.get('filter_booking_status')

    // 最早预约时间为计算字段，查询后内存筛选
    const earliest_appointment_time_from = searchParams.get(
      'filter_earliest_appointment_time_from'
    )
    const earliest_appointment_time_to = searchParams.get(
      'filter_earliest_appointment_time_to'
    )

    const planned_unload_at_from = searchParams.get('filter_planned_unload_at_from')
    const planned_unload_at_to = searchParams.get('filter_planned_unload_at_to')
    if (planned_unload_at_from || planned_unload_at_to) {
      where.orders = {
        ...where.orders,
        inbound_receipt: {
          ...(where.orders?.inbound_receipt || {}),
          planned_unload_at: {},
        },
      }
      if (planned_unload_at_from) {
        where.orders.inbound_receipt.planned_unload_at.gte = new Date(planned_unload_at_from)
      }
      if (planned_unload_at_to) {
        where.orders.inbound_receipt.planned_unload_at.lte = new Date(planned_unload_at_to)
      }
    }

    const pickup_date_from = searchParams.get('filter_pickup_date_from')
    const pickup_date_to = searchParams.get('filter_pickup_date_to')
    if (pickup_date_from || pickup_date_to) {
      where.orders = {
        ...where.orders,
        pickup_date: {},
      }
      if (pickup_date_from) {
        const fromDay = pickup_date_from.trim().split('T')[0]
        where.orders.pickup_date.gte = new Date(`${fromDay}T00:00:00.000Z`)
      }
      if (pickup_date_to) {
        const toDay = pickup_date_to.trim().split('T')[0]
        where.orders.pickup_date.lte = new Date(`${toDay}T23:59:59.999Z`)
      }
    }

    // 仅显示入库管理中状态为「已入库」的订单下的明细（与列表筛选「仅已入库」一致）
    const inboundReceiptStatusScope = searchParams.get('filter_inbound_receipt_status_scope')
    if (inboundReceiptStatusScope === 'received') {
      where.orders = {
        ...where.orders,
        inbound_receipt: {
          ...(where.orders?.inbound_receipt || {}),
          status: 'received',
        },
      }
    }

    // 排序
    const orderBy: any = {}
    if (sort === 'container_number') {
      orderBy.orders = { inbound_receipt: { container_number: order } }
    } else if (sort === 'customer_name') {
      orderBy.orders = { customers: { name: order } }
    } else if (sort === 'planned_unload_at') {
      orderBy.orders = { inbound_receipt: { planned_unload_at: order } }
    } else if (sort === 'pickup_date') {
      orderBy.orders = { pickup_date: order }
    } else if (sort === 'delivery_location_code') {
      orderBy.locations_order_detail_delivery_location_idTolocations = {
        location_code: order,
      }
    } else if (sort === 'operation_mode') {
      orderBy.orders = { operation_mode: order }
    } else if (sort === 'fist') {
      orderBy.orders = { fist: order }
    } else if (sort === 'storage_location_code') {
      // 仓库位置来自 inventory_lots，在下方对结果集内存排序；此处仅稳定 DB 返回顺序
      orderBy.id = order === 'asc' ? 'asc' : 'desc'
    } else {
      orderBy[sort] = order
    }

    // 查询数据
    // 预约状态、最早预约时间：先在完整 where 上算 order_detail_id，再分页
    // 按仓库位置排序：对 where 命中全量结果内存排序后分页
    // 若按 ids 筛选，则取满全部 id 且不分页
    const hasIdsFilter = Array.isArray(where.id?.in) && where.id.in.length > 0
    const hasBookingStatusFilter = booking_status_filter && booking_status_filter !== '__all__'
    const hasEarliestAppointmentTimeFilter = Boolean(
      earliest_appointment_time_from?.trim() || earliest_appointment_time_to?.trim()
    )
    const sortByStorageLocation = sort === 'storage_location_code'

    // 默认排除完成留档；按 ids 精确拉取时不过滤（预约等场景需拿到已选行）
    if (!includeArchived && !(idsParam && idsParam.trim())) {
      if (where.orders) {
        where.orders = mergeOrdersRelationExcludeArchived(where.orders)
      } else {
        where.orders = mergeOrdersRelationExcludeArchived(undefined)
      }
    }

    // 最早预约时间为计算字段：先在预约明细上算出符合条件的 order_detail_id，避免「先取 1 万条再内存筛」漏数据
    if (hasEarliestAppointmentTimeFilter) {
      const matchingIds = await findOrderDetailIdsByEarliestAppointmentTime(
        where,
        earliest_appointment_time_from,
        earliest_appointment_time_to
      )
      if (matchingIds.length === 0) {
        return NextResponse.json({
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        })
      }
      where.id = intersectOrderDetailIdFilter(where.id, matchingIds)
      const narrowed = where.id as { in: bigint[] }
      if (narrowed.in.length === 0) {
        return NextResponse.json({
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        })
      }
    }

    // 预约状态为计算字段：在完整 where 下先算符合条件的 id，避免先分页再筛漏数据
    if (hasBookingStatusFilter && booking_status_filter) {
      const matchingIds = await findOrderDetailIdsByBookingStatus(
        where,
        booking_status_filter
      )
      if (matchingIds.length === 0) {
        return NextResponse.json({
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        })
      }
      where.id = intersectOrderDetailIdFilter(where.id, matchingIds)
      const narrowedBooking = where.id as { in: bigint[] }
      if (narrowedBooking.in.length === 0) {
        return NextResponse.json({
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        })
      }
    }

    const needsInMemoryProcessing = sortByStorageLocation && !hasIdsFilter
    const queryLimit = hasIdsFilter
      ? (where.id as { in: bigint[] }).in.length
      : needsInMemoryProcessing
        ? undefined
        : limit
    const querySkip =
      hasIdsFilter || needsInMemoryProcessing ? undefined : (page - 1) * limit

    const [items, total] = await Promise.all([
      prisma.order_detail.findMany({
        where,
        orderBy,
        skip: querySkip,
        take: queryLimit,
        include: {
          orders: {
            select: orderDetailsOrdersSelect,
          },
          inventory_lots: {
            select: {
              inventory_lot_id: true,
              pallet_count: true,
              remaining_pallet_count: true,
              unbooked_pallet_count: true, // inventory_lots 中的字段（已入库时使用）
              pallet_counts_verified: true,
              storage_location_code: true,
              notes: true,
            },
            orderBy: [
              { pallet_count: 'desc' }, // 优先取板数最大的
              { created_at: 'desc' }, // 其次取最新的
            ],
            take: 1, // 只取第一个（一个 order_detail 可能对应多个 inventory_lots）
          },
          appointment_detail_lines: {
            where: prismaAppointmentDetailLinesWhereParentAppointmentActive,
            select: {
              id: true,
              appointment_id: true,
              order_detail_id: true,
              estimated_pallets: true,
              rejected_pallets: true,
              delivery_appointments: {
                select: {
                  appointment_id: true,
                  reference_number: true,
                  requested_start: true,
                  confirmed_start: true,
                  status: true,
                  verify_loading_sheet: true, // 校验装车单
                  can_create_sheet: true, // 可做单
                  has_created_sheet: true, // 已做单
                },
              },
            } as import('@prisma/client').Prisma.appointment_detail_linesSelect,
          },
          locations_order_detail_delivery_location_idTolocations: {
            select: {
              location_id: true,
              location_code: true,
              name: true,
            },
          },
        },
      }),
      prisma.order_detail.count({ where }),
    ])

    // delivery_location_id 现在有外键约束，关联数据通过 Prisma include 自动加载
    // 不需要手动查询 locations 了

    // 转换数据格式
    const transformedItems = items.map((item: any) => {
      // 获取 inventory_lots：优先取已填实际板数（含 0）的记录，否则取第一条（可能为未填 null）
      const inventoryLots = item.inventory_lots || []
      const ilWithValue = inventoryLots.find(
        (lot: any) => lot.pallet_count !== null && lot.pallet_count !== undefined
      )
      const il = ilWithValue || inventoryLots[0] || null
      
      const ir = item.orders?.inbound_receipt || null
      const customer = item.orders?.customers || null
      
      // 查询已排除已停用预约上的明细（与预约管理列表口径分离）
      const allAppointmentLines = item.appointment_detail_lines || []
      const validAppointmentLines = allAppointmentLines.filter((adl: any) => adl.delivery_appointments !== null)

      const appointments = validAppointmentLines.map((adl: any) => {
        const appointment = adl.delivery_appointments
        return {
          appointment_detail_line_id: String(adl.id),
          appointment_id: appointment?.appointment_id ? String(appointment.appointment_id) : null,
          reference_number: appointment?.reference_number || null,
          requested_start: appointment?.requested_start || null,
          confirmed_start: appointment?.confirmed_start || null,
          estimated_pallets: adl.estimated_pallets || 0,
          rejected_pallets: adl.rejected_pallets ?? 0,
          status: appointment?.status || null,
          verify_loading_sheet: appointment?.verify_loading_sheet === true || false,
          can_create_sheet: appointment?.can_create_sheet === true || false,
          has_created_sheet: appointment?.has_created_sheet === true || false,
        }
      })

      if (allAppointmentLines.length > validAppointmentLines.length) {
        const orphanedCount = allAppointmentLines.length - validAppointmentLines.length
        const orphanedPallets = allAppointmentLines
          .filter((adl: any) => adl.delivery_appointments === null)
          .reduce((sum: number, adl: any) => sum + (adl.estimated_pallets || 0), 0)
        console.warn(
          `[订单明细API] 订单明细 ${item.id} 存在 ${orphanedCount} 条孤立预约明细，共 ${orphanedPallets} 板，不计入未约。`
        )
      }

      const earliestAppointment =
        appointments.length > 0
          ? appointments.reduce((earliest: any, appt: any) => {
              const start = appt.confirmed_start || appt.requested_start
              const earliestStart = earliest.confirmed_start || earliest.requested_start
              if (!start) return earliest
              if (!earliestStart) return appt
              return new Date(start) < new Date(earliestStart) ? appt : earliest
            })
          : null
      const earliest_appointment_reference_number = earliestAppointment?.reference_number ?? null
      const earliest_appointment_time = earliestAppointment
        ? (earliestAppointment.confirmed_start || earliestAppointment.requested_start)
        : null

      const lotsForCalc = (item.inventory_lots || []).map((lot: any) => ({
        pallet_count: lot.pallet_count,
        pallet_counts_verified: lot.pallet_counts_verified === true,
        remaining_pallet_count: lot.remaining_pallet_count,
        unbooked_pallet_count: lot.unbooked_pallet_count,
      }))
      const appointmentsResolved = resolveAppointmentsFromOrderDetail({
        appointment_detail_lines: validAppointmentLines,
      })

      let remaining_pallets: number | null = null
      let delivery_progress = 0
      const unbooked_pallets = computeOrderDetailUnbookedPallets({
        estimated_pallets: item.estimated_pallets,
        inventory_lots: lotsForCalc,
        appointment_detail_lines: validAppointmentLines,
      })

      if (lotsForCalc.length > 0) {
        const state = computeInboundOrderDetailDeliveryState({
          lots: lotsForCalc,
          estimatedPallets: item.estimated_pallets,
          appointments: appointmentsResolved,
        })!
        remaining_pallets = state.totalRemainingPalletCount
        delivery_progress = state.deliveryProgress
      } else {
        remaining_pallets = null
        delivery_progress = 0
      }

      // 获取 location_code（从关联数据中获取）
      const delivery_location_code = item.locations_order_detail_delivery_location_idTolocations?.location_code || null

      return {
        id: String(item.id),
        inventory_lot_id: il?.inventory_lot_id != null ? String(il.inventory_lot_id) : null,
        order_id: item.order_id ? String(item.order_id) : null,
        inbound_receipt_id: ir?.inbound_receipt_id != null ? String(ir.inbound_receipt_id) : null,
        default_warehouse_id: defaultWarehouseIdStr,
        order_number: item.orders?.order_number || null,
        operation_mode: item.orders?.operation_mode ?? null,
        customer_name: customer?.name || null,
        fist: resolveOrderFistFromRelation(item.orders),
        container_number: item.orders?.order_number || null, // container_number 实际是 order_number
        planned_unload_at: ir?.planned_unload_at || null,
        pickup_date: item.orders?.pickup_date
          ? item.orders.pickup_date instanceof Date
            ? item.orders.pickup_date.toISOString().split('T')[0]
            : String(item.orders.pickup_date).split('T')[0]
          : null,
        delivery_location: delivery_location_code, // 使用 location_code 作为 delivery_location
        delivery_location_code,
        delivery_nature: item.delivery_nature,
        private_warehouse_info: item.private_warehouse_info ?? null,
        estimated_pallets: item.estimated_pallets || 0,
        actual_pallets: il?.pallet_count ?? null,
        pallet_counts_verified: il?.pallet_counts_verified === true,
        remaining_pallets, // 已入库：与入库详情相同口径（预约实时）；未入库 null
        unbooked_pallets, // 已入库：与入库详情相同口径；未入库 预计-预约
        storage_location_code: il?.storage_location_code || null,
        current_location: item.orders?.pickup_management?.current_location || null,
        notes: item.notes || null, // 备注应该关联订单明细的备注（order_detail.notes）
        window_period: item.window_period || null,
        fba: item.fba || null, // FBA字段
        po: item.po || null, // PO字段
        delivery_progress,
        appointments,
        earliest_appointment_reference_number,
        earliest_appointment_time,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }
    })

    // 按 ids 参数顺序排列（新建预约时保持勾选顺序；与按仓库位置排序互斥时以 ids 顺序为准）
    if (hasIdsFilter && where.id?.in?.length) {
      const idOrder = new Map((where.id.in as bigint[]).map((id, i) => [String(id), i]))
      transformedItems.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0))
    }

    let processedItems = transformedItems

    // 按仓库位置排序（关联 lot 字段，仅内存排序；按 ids 拉取时保持勾选顺序，不覆盖）
    if (sortByStorageLocation && !hasIdsFilter) {
      const dir = order === 'asc' ? 1 : -1
      const locKey = (row: any) => {
        const raw = row.storage_location_code
        if (raw == null || String(raw).trim() === '') return null
        return String(raw).trim().toLowerCase()
      }
      processedItems = [...processedItems].sort((a: any, b: any) => {
        const ka = locKey(a)
        const kb = locKey(b)
        if (ka === null && kb === null) return String(a.id).localeCompare(String(b.id))
        if (ka === null) return 1 // 无仓库位置排在后面
        if (kb === null) return -1
        const c = ka.localeCompare(kb, undefined, { numeric: true, sensitivity: 'base' })
        if (c !== 0) return dir * c
        return String(a.id).localeCompare(String(b.id))
      })
    }

    const finalTotal = needsInMemoryProcessing ? processedItems.length : total

    // 分页：按仓库位置排序时在内存中切片；ids 筛选返回全部
    const paginatedItems = hasIdsFilter
      ? processedItems
      : needsInMemoryProcessing
        ? processedItems.slice((page - 1) * limit, page * limit)
        : processedItems

    // 序列化 BigInt
    const serialized = serializeBigInt(paginatedItems)

    return NextResponse.json({
      data: serialized,
      pagination: {
        page,
        limit,
        total: finalTotal,
        totalPages: Math.ceil(finalTotal / limit),
      },
    })
  } catch (error: any) {
    console.error('获取订单明细列表失败:', error)
    return NextResponse.json(
      {
        error: error.message || '获取订单明细列表失败',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

