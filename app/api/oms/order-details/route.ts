import { NextRequest, NextResponse } from 'next/server'
import { checkAuth, serializeBigInt } from '@/lib/api/helpers'
import prisma from '@/lib/prisma'

/**
 * GET /api/oms/order-details
 * 获取所有订单明细（已入库 + 未入库）
 * 
 * 查询参数：
 * - page: 页码（默认1）
 * - limit: 每页数量（默认20，最大100）
 * - sort: 排序字段（默认id）
 * - order: 排序方向（asc/desc，默认desc）
 * - search: 搜索关键词（仅搜索柜号/订单号）
 * - filter_customer_name: 客户筛选
 * - filter_delivery_nature: 送仓性质筛选
 * - filter_delivery_location_code: 仓点筛选
 * - filter_booking_status: 预约状态筛选（unbooked/fully_booked/overbooked）
 * - filter_planned_unload_at_from/to: 预计拆柜日期范围筛选
 * 
 * 特殊说明：
 * - 未约板数是实时计算的（已入库用inventory_lots.unbooked_pallet_count，未入库用预计板数-预约板数之和）
 * - 未约板数允许负数（表示多约，会用红色显示）
 * - 当使用未约板数筛选时，会先查询所有数据再筛选，可能有性能影响
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const sort = searchParams.get('sort') || 'id'
    const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc'
    const search = searchParams.get('search') || ''

    // 构建查询条件
    const where: any = {
      // 不筛选已入库，显示所有订单明细
    }

    // 搜索条件（只搜索柜号，即订单号）
    if (search && search.trim()) {
      where.orders = {
        ...where.orders,
        order_number: { contains: search, mode: 'insensitive' },
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
      // 通过关联的 locations 表筛选 location_code
      where.locations_order_detail_delivery_location_idTolocations = {
        location_code: delivery_location,
      }
    }

    // 预约状态筛选（由于未约板数是实时计算的，需要在查询后筛选）
    // 先不在这里处理，在查询后根据计算出的未约板数筛选
    const booking_status_filter = searchParams.get('filter_booking_status')

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

    // 排序
    const orderBy: any = {}
    if (sort === 'container_number') {
      orderBy.orders = { inbound_receipt: { container_number: order } }
    } else if (sort === 'customer_name') {
      orderBy.orders = { customers: { name: order } }
    } else if (sort === 'planned_unload_at') {
      orderBy.orders = { inbound_receipt: { planned_unload_at: order } }
    } else if (sort === 'delivery_location_code') {
      orderBy.locations_order_detail_delivery_location_idTolocations = {
        location_code: order,
      }
    } else {
      orderBy[sort] = order
    }

    // 查询数据
    // 如果有预约状态筛选，需要先查询所有数据（因为未约板数是实时计算的），筛选后再分页
    // 为了性能考虑，设置最大查询限制（10000条）
    const hasBookingStatusFilter = booking_status_filter && booking_status_filter !== '__all__'
    const MAX_QUERY_LIMIT = 10000
    const queryLimit = hasBookingStatusFilter ? MAX_QUERY_LIMIT : limit
    const querySkip = hasBookingStatusFilter ? undefined : (page - 1) * limit
    
    const [items, total] = await Promise.all([
      prisma.order_detail.findMany({
        where,
        orderBy,
        skip: querySkip,
        take: queryLimit,
        include: {
          orders: {
            include: {
              customers: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
              inbound_receipt: {
                select: {
                  inbound_receipt_id: true,
                  planned_unload_at: true,
                  status: true,
                },
              },
            },
          },
          inventory_lots: {
            select: {
              inventory_lot_id: true,
              pallet_count: true,
              remaining_pallet_count: true,
              unbooked_pallet_count: true, // inventory_lots 中的字段（已入库时使用）
              storage_location_code: true,
              notes: true,
            },
            take: 1, // 只取第一个（一个 order_detail 可能对应多个 inventory_lots）
          },
          appointment_detail_lines: {
            select: {
              id: true,
              appointment_id: true,
              order_detail_id: true,
              estimated_pallets: true,
              delivery_appointments: {
                select: {
                  appointment_id: true,
                  reference_number: true,
                  confirmed_start: true,
                  status: true,
                },
              },
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
      const il = item.inventory_lots?.[0] || null
      const ir = item.orders?.inbound_receipt || null
      const customer = item.orders?.customers || null
      
      // 计算送货进度
      let delivery_progress = 0
      if (il?.pallet_count && il.pallet_count > 0) {
        const shipped = il.pallet_count - (il.remaining_pallet_count || 0)
        delivery_progress = Math.round((shipped / il.pallet_count) * 100)
      }

      // 聚合预约信息
      const appointments = item.appointment_detail_lines?.map((adl: any) => ({
        appointment_id: adl.delivery_appointments?.appointment_id ? String(adl.delivery_appointments.appointment_id) : null,
        reference_number: adl.delivery_appointments?.reference_number || null,
        confirmed_start: adl.delivery_appointments?.confirmed_start || null,
        estimated_pallets: adl.estimated_pallets || 0,
        status: adl.delivery_appointments?.status || null,
      })) || []

      // 计算所有预约的预计板数之和
      const totalAppointmentPallets = appointments.reduce((sum: number, appt: any) => sum + (appt.estimated_pallets || 0), 0)

      // 计算未约板数
      // 已入库：使用 inventory_lots.unbooked_pallet_count（如果为null则视为0）
      // 未入库：实时计算 = 预计板数 - 所有预约板数之和（允许负数，负数表示多约）
      const unbooked_pallets: number = il
        ? (il.unbooked_pallet_count ?? 0) // 已入库，使用 inventory_lots 的 unbooked_pallet_count，null时视为0
        : (item.estimated_pallets || 0) - totalAppointmentPallets // 未入库，实时计算（允许负数）

      // 获取 location_code（从关联数据中获取）
      const delivery_location_code = item.locations_order_detail_delivery_location_idTolocations?.location_code || null

      return {
        id: String(item.id),
        order_id: item.order_id ? String(item.order_id) : null,
        order_number: item.orders?.order_number || null,
        customer_name: customer?.name || null,
        container_number: item.orders?.order_number || null, // container_number 实际是 order_number
        planned_unload_at: ir?.planned_unload_at || null,
        delivery_location: item.delivery_location,
        delivery_location_code,
        delivery_nature: item.delivery_nature,
        estimated_pallets: item.estimated_pallets || 0,
        actual_pallets: il?.pallet_count || null,
        remaining_pallets: il?.remaining_pallet_count || null,
        unbooked_pallets, // 已入库用 inventory_lots.unbooked_pallet_count，未入库实时计算
        storage_location_code: il?.storage_location_code || null,
        notes: il?.notes || item.notes || null,
        delivery_progress,
        appointments,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }
    })

    /**
     * 预约状态筛选函数
     * 在查询后筛选，因为未约板数是实时计算的
     * @param items 待筛选的数据项数组
     * @param filterValue 筛选值：'unbooked'（未约）、'fully_booked'（约满）、'overbooked'（超约）
     * @returns 筛选后的数据项数组
     */
    const filterByBookingStatus = (items: any[], filterValue: string): any[] => {
      if (!filterValue || filterValue === '__all__') {
        return items
      }
      
      return items.filter((item: any) => {
        const unbooked = item.unbooked_pallets
        
        switch (filterValue) {
          case 'unbooked':
            // 未约：未约板数 > 0
            return unbooked > 0
          case 'fully_booked':
            // 约满：未约板数 = 0
            return unbooked === 0
          case 'overbooked':
            // 超约：未约板数 < 0
            return unbooked < 0
          default:
            return true
        }
      })
    }

    // 应用预约状态筛选
    const filteredItems = filterByBookingStatus(transformedItems, booking_status_filter || '')
    const finalTotal = hasBookingStatusFilter ? filteredItems.length : total

    // 性能提示：如果查询的数据量达到上限，可能有数据未被筛选
    if (hasBookingStatusFilter && items.length >= MAX_QUERY_LIMIT) {
      console.warn(`[order-details] 预约状态筛选查询已达到上限 ${MAX_QUERY_LIMIT} 条记录，可能有数据未包含在筛选结果中，建议添加其他筛选条件`)
    }

    // 应用分页（在筛选后，如果有筛选的话）
    const paginatedItems = hasBookingStatusFilter
      ? filteredItems.slice((page - 1) * limit, page * limit)
      : filteredItems

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

