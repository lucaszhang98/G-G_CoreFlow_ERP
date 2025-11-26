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
      OR?: Array<{ orders: { order_number: { contains: string; mode: 'insensitive' } } } | { orders: { mbl_number: { contains: string; mode: 'insensitive' } } } | { orders: { [key: string]: any } }>
      AND?: Array<{ orders: { [key: string]: any } }>
    } = {
      source_type: 'sea_container',
    }

    // 简单搜索条件（搜索订单号、MBL）
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
        {
          orders: {
            mbl_number: {
              contains: search,
              mode: 'insensitive' as const,
            },
          },
        },
      ]
    }

    // 筛选条件（快速筛选）
    // ETA日期范围筛选
    const etaFrom = searchParams.get('filter_eta_date_from')
    const etaTo = searchParams.get('filter_eta_date_to')
    if (etaFrom || etaTo) {
      const etaCondition: any = {}
      if (etaFrom) {
        etaCondition.gte = new Date(etaFrom)
      }
      if (etaTo) {
        const endDate = new Date(etaTo)
        endDate.setHours(23, 59, 59, 999)
        etaCondition.lte = endDate
      }
      if (!where.AND) where.AND = []
      where.AND.push({ orders: { eta_date: etaCondition } })
    }

    // 提柜日期范围筛选
    const pickupFrom = searchParams.get('filter_pickup_date_from')
    const pickupTo = searchParams.get('filter_pickup_date_to')
    if (pickupFrom || pickupTo) {
      const pickupCondition: any = {}
      if (pickupFrom) {
        pickupCondition.gte = new Date(pickupFrom)
      }
      if (pickupTo) {
        const endDate = new Date(pickupTo)
        endDate.setHours(23, 59, 59, 999)
        pickupCondition.lte = endDate
      }
      if (!where.AND) where.AND = []
      where.AND.push({ orders: { pickup_date: pickupCondition } })
    }

    // 还柜日期范围筛选
    const returnFrom = searchParams.get('filter_return_date_from')
    const returnTo = searchParams.get('filter_return_date_to')
    if (returnFrom || returnTo) {
      const returnCondition: any = {}
      if (returnFrom) {
        returnCondition.gte = new Date(returnFrom)
      }
      if (returnTo) {
        const endDate = new Date(returnTo)
        endDate.setHours(23, 59, 59, 999)
        returnCondition.lte = endDate
      }
      if (!where.AND) where.AND = []
      where.AND.push({ orders: { return_deadline: returnCondition } })
    }

    // 码头/查验站筛选
    const filterPortLocation = searchParams.get('filter_port_location')
    if (filterPortLocation) {
      if (!where.AND) where.AND = []
      where.AND.push({
        orders: {
          port_location: {
            equals: filterPortLocation,
            mode: 'insensitive' as const,
          },
        },
      })
    }

    // 承运公司筛选
    const filterCarrier = searchParams.get('filter_carrier')
    if (filterCarrier) {
      if (!where.AND) where.AND = []
      const carrierIdBigInt = BigInt(filterCarrier)
      where.AND.push({
        orders: {
          carrier_id: carrierIdBigInt,
        },
      })
    }

    // 操作方式筛选
    const filterOperationMode = searchParams.get('filter_operation_mode')
    if (filterOperationMode) {
      if (!where.AND) where.AND = []
      where.AND.push({
        orders: {
          operation_mode: {
            equals: filterOperationMode,
            mode: 'insensitive' as const,
          },
        },
      })
    }

    // 高级搜索条件（多条件组合）
    const advancedLogic = searchParams.get('advanced_logic') || 'AND'
    const advancedConditions: any[] = []

    // 客户搜索
    const advancedCustomer = searchParams.get('advanced_customer')
    if (advancedCustomer) {
      advancedConditions.push({
        orders: {
          customers: {
            name: {
              contains: advancedCustomer,
              mode: 'insensitive' as const,
            },
          },
        },
      })
    }

    // 码头/查验站搜索
    const advancedPortLocation = searchParams.get('advanced_port_location')
    if (advancedPortLocation) {
      advancedConditions.push({
        orders: {
          port_location: {
            contains: advancedPortLocation,
            mode: 'insensitive' as const,
          },
        },
      })
    }

    // 操作方式搜索
    const advancedOperationMode = searchParams.get('advanced_operation_mode')
    if (advancedOperationMode) {
      advancedConditions.push({
        orders: {
          operation_mode: {
            contains: advancedOperationMode,
            mode: 'insensitive' as const,
          },
        },
      })
    }

    // 送货地搜索
    const advancedDeliveryLocation = searchParams.get('advanced_delivery_location')
    if (advancedDeliveryLocation) {
      advancedConditions.push({
        orders: {
          delivery_location: {
            contains: advancedDeliveryLocation,
            mode: 'insensitive' as const,
          },
        },
      })
    }

    // 预约时间范围搜索
    const appointmentFrom = searchParams.get('advanced_appointment_time_from')
    const appointmentTo = searchParams.get('advanced_appointment_time_to')
    if (appointmentFrom || appointmentTo) {
      const appointmentCondition: any = {}
      if (appointmentFrom) {
        appointmentCondition.gte = new Date(appointmentFrom)
      }
      if (appointmentTo) {
        const endDate = new Date(appointmentTo)
        endDate.setHours(23, 59, 59, 999)
        appointmentCondition.lte = endDate
      }
      advancedConditions.push({
        orders: { appointment_time: appointmentCondition },
      })
    }

    // 根据逻辑组合高级搜索条件
    if (advancedConditions.length > 0) {
      if (advancedLogic === 'OR') {
        // OR 逻辑：与现有的 where.OR 合并
        if (where.OR) {
          where.OR = [...where.OR, ...advancedConditions]
        } else {
          where.OR = advancedConditions
        }
      } else {
        // AND 逻辑：所有条件都必须满足
        if (!where.AND) where.AND = []
        where.AND.push(...advancedConditions)
      }
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
            // port_location_id: true, // 暂时注释，等数据库添加字段后再启用
            operation_mode: true,
            delivery_location: true,
            carrier_id: true,
            // port_location_rel: { // 暂时注释，等数据库添加字段后再启用
            //   select: {
            //     location_id: true,
            //     name: true,
            //     location_code: true,
            //     location_type: true,
            //   },
            // },
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
        // 3. 码头/查验站 - 使用 port_location 文本（暂时，等数据库添加 port_location_id 字段后再使用关联查询）
        port_location: order?.port_location || null,
        port_location_id: null, // 暂时为null，等数据库添加字段后再启用
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

