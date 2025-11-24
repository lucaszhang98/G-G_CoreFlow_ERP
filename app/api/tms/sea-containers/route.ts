import { NextRequest, NextResponse } from 'next/server'
import { checkAuth, parsePaginationParams, buildPaginationResponse, serializeBigInt } from '@/lib/api/helpers'
import prisma from '@/lib/prisma'

// GET - 获取海柜列表（只返回 source_type = 'sea_container' 的容器）
export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    const searchParams = request.nextUrl.searchParams
    const { page, limit } = parsePaginationParams(searchParams, 'created_at', 'desc')
    const search = searchParams.get('search') || ''

    // 构建查询条件 - 只查询海柜
    const where: {
      source_type: string
      OR?: Array<{ orders: { order_number: { contains: string; mode: 'insensitive' } } }>
    } = {
      source_type: 'sea_container',
    }

    // 搜索条件（搜索容器ID、订单号、MBL）
    if (search) {
      where.OR = [
        {
          orders: {
            order_number: {
              contains: search,
              mode: 'insensitive' as const,
            },
          },
        },
      ]
    }

    // 查询总数
    const total = await prisma.containers.count({ where })

    // 查询数据，包含所有需要的关联信息
    const containers = await prisma.containers.findMany({
      where,
      include: {
        orders: {
          select: {
            order_id: true,
            order_number: true,
            order_date: true,
            mbl_number: true,
            do_issued: true,
            container_type: true,
            eta_date: true,
            lfd_date: true,
            pickup_date: true,
            return_deadline: true,
            warehouse_account: true,
            appointment_time: true,
            port_location: true,
            operation_mode: true,
            delivery_location: true,
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
            delivery_appointments: {
              select: {
                appointment_id: true,
                reference_number: true,
                confirmed_start: true,
                requested_start: true,
                status: true,
              },
              take: 1, // 只取第一个预约（用于预约号码）
            },
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    })

    // 序列化数据并格式化
    const serializedContainers = containers.map((container: any) => {
      const serialized = serializeBigInt(container)
      const order = serialized.orders
      const appointment = order?.delivery_appointments?.[0]

      // 获取预约号码 - 动态提取（从delivery_appointments的reference_number）
      const appointmentNumber = appointment?.reference_number || null

      return {
        container_id: String(serialized.container_id || ''),
        // 1. 柜号 - 使用订单号（orders.order_number）
        container_number: order?.order_number || null,
        // 2. MBL
        mbl: order?.mbl_number || null,
        // 3. 码头/查验站 - 从orders表直接获取
        port_location: order?.port_location || null,
        // 4. 客户
        customer: order?.customers?.name || null,
        customer_code: order?.customers?.code || null,
        // 5. 柜型
        container_type: order?.container_type || null,
        // 6. 承运公司 - 从orders表的carriers关联获取
        carrier: order?.carriers?.name || null,
        // 7. DO
        do_issued: order?.do_issued || false,
        // 8. 订单日期
        order_date: order?.order_date || null,
        // 9. ETA
        eta_date: order?.eta_date || null,
        // 10. 操作方式 - 从orders表直接获取
        operation_mode: order?.operation_mode || null,
        // 11. 送货地 - 从orders表直接获取
        delivery_location: order?.delivery_location || null,
        // 12. LFD
        lfd_date: order?.lfd_date || null,
        // 13. 提柜日期
        pickup_date: order?.pickup_date || null,
        // 14. 还柜日期
        return_date: order?.return_deadline || null,
        // 15. 预约号码 - 动态提取（从delivery_appointments的reference_number）
        appointment_number: appointmentNumber,
        // 16. 预约时间 - 从orders表获取
        appointment_time: order?.appointment_time || null,
        // 17. 约仓账号
        warehouse_account: order?.warehouse_account || null,
        // 额外信息
        order_id: order ? String(order.order_id || '') : null,
        order_number: order?.order_number || null,
        status: serialized.status || null,
        created_at: serialized.created_at || null,
      }
    })

    return NextResponse.json(
      buildPaginationResponse(serializedContainers, total, page, limit)
    )
  } catch (error: any) {
    console.error('获取海柜列表失败:', error)
    console.error('错误详情:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack,
    })
    return NextResponse.json(
      { 
        error: error.message || '获取海柜列表失败',
        code: error.code,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

