import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { generateOrderExportExcel, OrderExportData } from '@/lib/utils/order-export-excel'

/**
 * GET /api/oms/orders/export
 * 导出订单数据为Excel文件
 * 
 * 查询参数：
 * - all=true: 导出全部数据
 * - 其他参数与列表API相同（用于导出筛选结果）：
 *   - search: 搜索关键词
 *   - filter_*: 各种筛选条件
 *   - sort, order: 排序
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const exportAll = searchParams.get('all') === 'true'

    // 构建查询条件（与列表API相同的逻辑）
    const where: any = {}

    // 如果不是导出全部，则应用筛选条件
    if (!exportAll) {
      // 搜索条件
      const search = searchParams.get('search')
      if (search && search.trim()) {
        where.order_number = { contains: search, mode: 'insensitive' as const }
      }

      // 筛选条件
      // 客户筛选
      const customer_id = searchParams.get('filter_customer')
      if (customer_id && customer_id !== '__all__') {
        where.customer_id = BigInt(customer_id)
      }

      // 状态筛选
      const status = searchParams.get('filter_status')
      if (status && status !== '__all__') {
        where.status = status
      } else if (!searchParams.get('includeArchived')) {
        // 默认排除"完成留档"状态
        where.status = { not: 'archived' }
      }

      // 操作方式筛选
      const operation_mode = searchParams.get('filter_operation_mode')
      if (operation_mode && operation_mode !== '__all__') {
        where.operation_mode = operation_mode
      }

      // 日期范围筛选 - 订单日期
      const order_date_from = searchParams.get('filter_order_date_from')
      const order_date_to = searchParams.get('filter_order_date_to')
      if (order_date_from || order_date_to) {
        where.order_date = {}
        if (order_date_from) {
          where.order_date.gte = new Date(order_date_from)
        }
        if (order_date_to) {
          const endDate = new Date(order_date_to)
          endDate.setHours(23, 59, 59, 999)
          where.order_date.lte = endDate
        }
      }

      // 其他日期筛选...
      const eta_date_from = searchParams.get('filter_eta_date_from')
      const eta_date_to = searchParams.get('filter_eta_date_to')
      if (eta_date_from || eta_date_to) {
        where.eta_date = {}
        if (eta_date_from) where.eta_date.gte = new Date(eta_date_from)
        if (eta_date_to) {
          const endDate = new Date(eta_date_to)
          endDate.setHours(23, 59, 59, 999)
          where.eta_date.lte = endDate
        }
      }
    }

    // 排序
    const sort = searchParams.get('sort') || 'created_at'
    const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc'
    const orderBy: any = { [sort]: order }

    // 查询数据（限制最多10000条）
    const orders = await prisma.orders.findMany({
      where,
      orderBy,
      take: 10000, // 防止导出过多数据导致性能问题
      include: {
        customers: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        users_orders_user_idTousers: {
          select: {
            id: true,
            full_name: true,
          },
        },
        carriers: {
          select: {
            carrier_id: true,
            name: true,
          },
        },
        locations_orders_port_location_idTolocations: {
          select: {
            location_id: true,
            location_code: true,
            name: true,
          },
        },
        locations_orders_delivery_location_idTolocations: {
          select: {
            location_id: true,
            location_code: true,
            name: true,
          },
        },
        order_detail: {
          select: {
            volume: true,
          },
        },
      },
    })

    // 转换数据格式
    const exportData: OrderExportData[] = orders.map((order: any) => {
      // 计算整柜体积：从 order_detail 的 volume 总和得出
      let calculatedVolume = 0
      if (order.order_detail && Array.isArray(order.order_detail)) {
        calculatedVolume = order.order_detail.reduce((sum: number, detail: any) => {
          let volume = 0
          if (detail.volume !== null && detail.volume !== undefined) {
            if (typeof detail.volume === 'object' && 'toNumber' in detail.volume) {
              volume = detail.volume.toNumber()
            } else {
              volume = Number(detail.volume)
            }
          }
          return sum + (isNaN(volume) ? 0 : volume)
        }, 0)
      }

      const portLocationCode = order.locations_orders_port_location_idTolocations?.location_code || 
                               order.locations_orders_port_location_idTolocations?.name || null

      return {
        order_number: order.order_number,
        customer_code: order.customers?.code || null,
        customer_name: order.customers?.name || null,
        user_name: order.users_orders_user_idTousers?.full_name || null,
        order_date: order.order_date,
        status: order.status,
        operation_mode: order.operation_mode,
        delivery_location: order.locations_orders_delivery_location_idTolocations?.location_code || null,
        container_type: order.container_type,
        container_volume: calculatedVolume || null,
        eta_date: order.eta_date,
        lfd_date: order.lfd_date,
        pickup_date: order.pickup_date,
        ready_date: order.ready_date,
        return_deadline: order.return_deadline,
        carrier_name: order.carriers?.name || null,
        port_location: portLocationCode,
        mbl_number: order.mbl_number,
        do_issued: order.do_issued,
        notes: order.notes,
        created_at: order.created_at,
        updated_at: order.updated_at,
      }
    })

    // 生成Excel
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const filename = exportAll
      ? `订单管理_全部_${timestamp}`
      : `订单管理_筛选_${timestamp}`

    const workbook = await generateOrderExportExcel(exportData, filename)

    // 生成buffer
    const buffer = await workbook.xlsx.writeBuffer()

    // 返回Excel文件
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}.xlsx"`,
      },
    })
  } catch (error: any) {
    console.error('导出订单数据失败:', error)
    return NextResponse.json(
      {
        error: error.message || '导出订单数据失败',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

