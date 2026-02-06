import { NextRequest, NextResponse } from 'next/server'
import { checkAuth, serializeBigInt } from '@/lib/api/helpers'
import prisma from '@/lib/prisma'
import { pickupManagementConfig } from '@/lib/crud/configs/pickup-management'
import { buildFilterConditions, mergeFilterConditions } from '@/lib/crud/filter-helper'
import { enhanceConfigWithSearchFields } from '@/lib/crud/search-config-generator'

// GET - 获取提柜管理列表
export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const sort = searchParams.get('sort') || 'created_at'
    const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc'
    const search = searchParams.get('search') || ''

    // 增强配置，确保 filterFields 已生成
    const enhancedConfig = enhanceConfigWithSearchFields(pickupManagementConfig)

    // 构建查询条件 - 直接查询 pickup_management 表
    const where: any = {}

    // 使用统一的筛选逻辑
    const filterConditions = buildFilterConditions(enhancedConfig, searchParams)
    
    // 分离主表字段和关联表字段的筛选条件
    const mainTableConditions: any[] = []
    const ordersConditions: any = {}
    
    filterConditions.forEach((condition) => {
      Object.keys(condition).forEach((fieldName) => {
        // 判断字段是否来自 orders 表
        // 主表字段：pickup_id, order_id, status, notes, earliest_appointment_time, current_location, port_text, shipping_line, driver_id
        // 其他字段都来自 orders 表
        const mainTableFields = ['pickup_id', 'order_id', 'pickup_out', 'report_empty', 'return_empty', 'notes', 'earliest_appointment_time', 'current_location', 'port_text', 'shipping_line', 'driver_id', 'driver_name']
        if (mainTableFields.includes(fieldName)) {
          mainTableConditions.push(condition)
        } else {
          // 字段来自 orders 表
          Object.assign(ordersConditions, condition)
        }
      })
    })
    
    // 合并主表筛选条件
    if (mainTableConditions.length > 0) {
      mergeFilterConditions(where, mainTableConditions)
    }
    
    // 合并 orders 表的筛选条件
    if (Object.keys(ordersConditions).length > 0) {
      if (where.orders) {
        // 如果已有 orders 条件，合并
        where.orders = {
          ...where.orders,
          ...ordersConditions,
        }
      } else {
        where.orders = ordersConditions
      }
    }

    // 搜索条件（搜索订单号、MBL）- 通过关联的 orders 表搜索
    if (search) {
      const searchCondition = {
        OR: [
          {
            order_number: {
              contains: search,
              mode: 'insensitive' as const,
            },
          },
          {
            mbl_number: {
              contains: search,
              mode: 'insensitive' as const,
            },
          },
        ],
      }
      
      // 如果已有 orders 条件，合并搜索条件
      if (where.orders) {
        where.orders = {
          ...where.orders,
          ...searchCondition,
        }
      } else {
        where.orders = searchCondition
      }
    }

    // 查询总数
    const total = await prisma.pickup_management.count({ where })

    // 构建排序条件
    let orderBy: any
    
    // 判断排序字段是来自主表还是 orders 表
    const mainTableFields = ['pickup_id', 'pickup_out', 'report_empty', 'return_empty', 'notes', 'current_location', 'port_text', 'shipping_line', 'driver_id', 'driver_name', 'created_at', 'updated_at']
    
    // earliest_appointment_time 特殊处理：优先使用 orders.appointment_time 排序
    if (sort === 'earliest_appointment_time') {
      orderBy = {
        orders: {
          appointment_time: order
        }
      }
    } else if (mainTableFields.includes(sort)) {
      // 主表字段直接排序
      orderBy = { [sort]: order }
    } else {
      // orders 表字段使用嵌套排序
      orderBy = {
        orders: {
          [sort]: order
        }
      }
    }

    // 查询数据
    const pickups = await prisma.pickup_management.findMany({
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
            ready_date: true,
            return_deadline: true,
            warehouse_account: true,
            appointment_time: true,
            operation_mode: true,
            port_location: true,
            port_location_id: true,
            delivery_location: true,
            delivery_location_id: true,
            carrier_id: true,
            locations_orders_port_location_idTolocations: {
              select: {
                location_id: true,
                name: true,
                location_code: true,
                location_type: true,
              },
            },
            locations_orders_delivery_location_idTolocations: {
              select: {
                location_id: true,
                name: true,
                location_code: true,
                location_type: true,
              },
            },
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
          },
        },
        drivers: {
          select: {
            driver_id: true,
            driver_code: true,
            license_number: true,
            license_plate: true,
          },
        },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    })

    // 序列化数据并格式化
    const serializedPickups = pickups.map((pickup: any) => {
      const serialized = serializeBigInt(pickup)
      const order = serialized.orders

      return {
        pickup_id: String(serialized.pickup_id || ''),
        container_id: String(serialized.pickup_id || ''), // 兼容海柜管理的字段名
        // ========== 订单基础信息（从 orders 获取，与海柜管理字段一致）==========
        container_number: order?.order_number || null,
        mbl: order?.mbl_number || null,
        customer: order?.customers || null, // 返回完整的 customer 对象，用于 relation 类型字段
        customer_id: order?.customers?.id ? String(order.customers.id) : null,
        container_type: order?.container_type || null,
        do_issued: order?.do_issued || false,
        order_date: order?.order_date || null,
        eta_date: order?.eta_date || null,
        operation_mode: order?.operation_mode || null,
        operation_mode_display: order?.operation_mode === 'unload' ? '拆柜' : order?.operation_mode === 'direct_delivery' ? '直送' : order?.operation_mode || null,
        delivery_location: order?.locations_orders_delivery_location_idTolocations?.location_code || order?.delivery_location || null,
        delivery_location_id: order?.delivery_location_id ? String(order.delivery_location_id) : null,
        lfd_date: order?.lfd_date || null,
        pickup_date: order?.pickup_date || null,
        ready_date: order?.ready_date || null,
        return_deadline: order?.return_deadline || null,
        warehouse_account: order?.warehouse_account || null,
        appointment_time: order?.appointment_time || null, // 从 orders 表读取预约时间
        port_location: order?.locations_orders_port_location_idTolocations?.location_code || null, // 返回location_code（数字代码）- 来自orders表关联
        port_location_id: order?.port_location_id ? String(order.port_location_id) : null,
        carrier: order?.carriers || null, // 返回完整的 carrier 对象，用于 relation 类型字段
        carrier_id: order?.carrier_id ? String(order.carrier_id) : null,
        // ========== 提柜管理自有字段（TMS 独有）==========
        port_text: serialized.port_text || null, // 码头位置（文本字段，来自 pickup_management）
        shipping_line: serialized.shipping_line || null, // 船司（文本字段，来自 pickup_management）
        driver_name: serialized.driver_name ?? serialized.drivers?.driver_code ?? null, // 司机（文本框，优先 driver_name，兼容旧 driver_id）
        earliest_appointment_time: order?.appointment_time || serialized.earliest_appointment_time || null, // 优先使用 orders.appointment_time，否则使用 pickup_management.earliest_appointment_time
        current_location: serialized.current_location || null,
        pickup_out: serialized.pickup_out ?? false,
        report_empty: serialized.report_empty ?? false,
        return_empty: serialized.return_empty ?? false,
        notes: serialized.notes || null, // 使用 pickup_management 的 notes，不是 orders 的
        // ========== 额外信息 ==========
        order_id: order ? String(order.order_id || '') : null,
        order_number: order?.order_number || null,
        created_at: serialized.created_at || null,
        updated_at: serialized.updated_at || null,
      }
    })

    return NextResponse.json({
      data: serializedPickups,
      total,
      page,
      limit,
    })
  } catch (error: any) {
    console.error('获取提柜管理列表失败:', error)
    return NextResponse.json(
      {
        error: error.message || '获取提柜管理列表失败',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

