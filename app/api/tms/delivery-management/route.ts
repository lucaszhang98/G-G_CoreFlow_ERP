import { NextRequest, NextResponse } from 'next/server'
import { checkAuth, serializeBigInt } from '@/lib/api/helpers'
import prisma from '@/lib/prisma'
import { deliveryManagementConfig } from '@/lib/crud/configs/delivery-management'
import { buildFilterConditions, mergeFilterConditions } from '@/lib/crud/filter-helper'
import { enhanceConfigWithSearchFields } from '@/lib/crud/search-config-generator'

// GET - 获取送仓管理列表
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
    const enhancedConfig = enhanceConfigWithSearchFields(deliveryManagementConfig)

    // 构建查询条件 - 直接查询 delivery_management 表
    const where: any = {}

    // 使用统一的筛选逻辑
    const filterConditions = buildFilterConditions(enhancedConfig, searchParams)
    
    // 分离主表字段和关联表字段的筛选条件
    const mainTableConditions: any[] = []
    const appointmentsConditions: any = {}
    const dateConditions: any[] = [] // 用于存储 delivery_date 和 appointment_time 的日期筛选条件
    
    filterConditions.forEach((condition) => {
      Object.keys(condition).forEach((fieldName) => {
        // 判断字段是否来自 delivery_appointments 表
        // 主表字段：delivery_id, appointment_id, driver_id, status, notes
        // 其他字段都来自 delivery_appointments 表
        const mainTableFields = ['delivery_id', 'appointment_id', 'driver_id', 'status', 'notes']
        if (mainTableFields.includes(fieldName)) {
          mainTableConditions.push(condition)
        } else {
          // 字段来自 delivery_appointments 表
          // 需要映射字段名：
          // - destination_location_id -> location_id
          // - delivery_date -> confirmed_start 或 requested_start (计算字段)
          // - appointment_time -> confirmed_start 或 requested_start (计算字段)
          let mappedFieldName = fieldName
          if (fieldName === 'destination_location_id') {
            mappedFieldName = 'location_id'
            appointmentsConditions[mappedFieldName] = condition[fieldName]
          } else if (fieldName === 'delivery_date' || fieldName === 'appointment_time') {
            // delivery_date 和 appointment_time 是计算字段，来自 confirmed_start 或 requested_start
            // 筛选时需要同时检查这两个字段（使用 OR 逻辑）
            const dateCondition = condition[fieldName]
            if (dateCondition) {
              dateConditions.push({
                OR: [
                  { confirmed_start: dateCondition },
                  { requested_start: dateCondition },
                ],
              })
            }
          } else {
            // 其他字段直接映射（使用映射后的字段名）
            appointmentsConditions[mappedFieldName] = condition[fieldName]
          }
        }
      })
    })
    
    // 如果有日期筛选条件，需要合并到 appointmentsConditions
    if (dateConditions.length > 0) {
      if (Object.keys(appointmentsConditions).length > 0) {
        // 如果已有其他条件，使用 AND 逻辑组合
        appointmentsConditions.AND = [
          ...Object.entries(appointmentsConditions).map(([key, value]) => ({ [key]: value })),
          ...dateConditions,
        ]
        // 清空直接字段，因为已经移到 AND 中
        Object.keys(appointmentsConditions).forEach(key => {
          if (key !== 'AND') delete appointmentsConditions[key]
        })
      } else {
        // 如果只有日期条件，直接使用 OR 逻辑
        if (dateConditions.length === 1) {
          Object.assign(appointmentsConditions, dateConditions[0])
        } else {
          appointmentsConditions.AND = dateConditions
        }
      }
    }
    
    // 合并主表筛选条件
    if (mainTableConditions.length > 0) {
      mergeFilterConditions(where, mainTableConditions)
    }
    
    // 合并 delivery_appointments 表的筛选条件
    if (Object.keys(appointmentsConditions).length > 0) {
      if (where.delivery_appointments) {
        // 如果已有 delivery_appointments 条件，合并
        where.delivery_appointments = {
          ...where.delivery_appointments,
          ...appointmentsConditions,
        }
      } else {
        where.delivery_appointments = appointmentsConditions
      }
    }

    // 搜索条件（搜索预约号码、柜号、PO）- 通过关联的 delivery_appointments 和 orders 表搜索
    if (search) {
      const searchCondition = {
        OR: [
          {
            reference_number: {
              contains: search,
              mode: 'insensitive' as const,
            },
          },
          {
            orders: {
              order_number: {
                contains: search,
                mode: 'insensitive' as const,
              },
            },
          },
          {
            appointment_detail_lines: {
              some: {
                order_detail: {
                  po: {
                    contains: search,
                    mode: 'insensitive' as const,
                  },
                },
              },
            },
          },
        ],
      }
      
      // 如果已有 delivery_appointments 条件，合并搜索条件
      if (where.delivery_appointments) {
        where.delivery_appointments = {
          ...where.delivery_appointments,
          ...searchCondition,
        }
      } else {
        where.delivery_appointments = searchCondition
      }
    }

    // 查询总数
    const total = await prisma.delivery_management.count({ where })

    // 查询数据
    const deliveries = await prisma.delivery_management.findMany({
      where,
      include: {
        delivery_appointments: {
          select: {
            appointment_id: true,
            reference_number: true,
            order_id: true,
            location_id: true,
            origin_location_id: true,
            appointment_type: true,
            delivery_method: true,
            appointment_account: true,
            confirmed_start: true,
            requested_start: true,
            rejected: true,
            locations: {
              select: {
                location_id: true,
                name: true,
                location_code: true,
                location_type: true,
              },
            },
            locations_delivery_appointments_origin_location_idTolocations: {
              select: {
                location_id: true,
                name: true,
                location_code: true,
                location_type: true,
              },
            },
            orders: {
              select: {
                order_id: true,
                order_number: true,
                warehouse_account: true,
              },
            },
            appointment_detail_lines: {
              select: {
                order_detail_id: true,
                order_detail: {
                  select: {
                    po: true,
                    order_id: true,
                    orders: {
                      select: {
                        order_id: true,
                        order_number: true,
                      },
                    },
                  },
                },
              },
            },
            outbound_shipments: {
              select: {
                outbound_shipment_id: true,
                trailer_id: true,
                trailer_code: true, // trailer_code 现在是直接存储在 outbound_shipments 表中的文本字段
              },
            },
          },
        },
        drivers: {
          select: {
            driver_id: true,
            driver_code: true,
            contact_roles: {
              select: {
                name: true,
                phone: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        created_at: order,
      },
      skip: (page - 1) * limit,
      take: limit,
    })

    // 序列化数据并格式化
    const serializedDeliveries = await Promise.all(deliveries.map(async (delivery: any) => {
      const serialized = serializeBigInt(delivery)
      const appointment = serialized.delivery_appointments
      const order = appointment?.orders
      const driver = serialized.drivers

      // 聚合 PO（从 appointment_detail_lines 获取）
      const poList = appointment?.appointment_detail_lines
        ?.map((line: any) => line.order_detail?.po)
        .filter((po: any) => po) || []
      const po = poList.length > 0 ? poList.join(', ') : null

      // 送货日期：优先使用 confirmed_start，否则使用 requested_start
      const deliveryDate = appointment?.confirmed_start || appointment?.requested_start || null

      // 优先从 delivery_management.container_number 获取柜号（如果已存储）
      // 如果没有存储，则根据派送方式自动计算并更新
      let containerNumber: string | null = serialized.container_number || null
      
      // 调试日志：记录第一条直送记录的柜号获取情况
      if (appointment?.delivery_method === '直送' && !containerNumber) {
        console.log(`[送仓管理] 直送记录缺少柜号 - delivery_id: ${serialized.delivery_id}, appointment_id: ${appointment?.appointment_id}, order_id: ${appointment?.order_id}, order_number: ${order?.order_number}`)
      }
      
      // 如果表中没有柜号，根据派送方式自动获取
      if (!containerNumber) {
        if (appointment?.delivery_method === '直送') {
          // 直送：优先从 appointment.orders.order_number 获取，如果没有则从 appointment_detail_lines 关联的 order_detail.orders.order_number 获取
          containerNumber = order?.order_number || null
          
          // 如果 appointment.order_id 为空，尝试从 appointment_detail_lines 获取
          if (!containerNumber && appointment?.appointment_detail_lines && appointment.appointment_detail_lines.length > 0) {
            // 从第一个 appointment_detail_line 的 order_detail.orders.order_number 获取
            const firstLine = appointment.appointment_detail_lines[0]
            containerNumber = firstLine?.order_detail?.orders?.order_number || null
          }
          
          if (containerNumber) {
            console.log(`[送仓管理] 直送记录自动获取柜号 - delivery_id: ${serialized.delivery_id}, container_number: ${containerNumber}`)
          } else {
            console.warn(`[送仓管理] 直送记录无法获取柜号 - delivery_id: ${serialized.delivery_id}, appointment.order_id: ${appointment?.order_id}, appointment_detail_lines:`, appointment?.appointment_detail_lines?.length || 0)
          }
        } else if (appointment?.delivery_method === '卡派' || appointment?.delivery_method === '自提') {
          // 卡派/自提：从 outbound_shipments.trailer_code 获取（现在是直接存储在表中的文本字段）
          containerNumber = appointment?.outbound_shipments?.trailer_code || null
        }
        
        // 如果计算出了柜号但表中没有，自动更新到数据库（同步更新，确保数据一致性）
        if (containerNumber) {
          try {
            await prisma.delivery_management.update({
              where: { delivery_id: BigInt(serialized.delivery_id) },
              data: { container_number: containerNumber } as any,
            })
            console.log(`[送仓管理] 成功更新柜号到数据库 - delivery_id: ${serialized.delivery_id}, container_number: ${containerNumber}`)
          } catch (err: any) {
            console.error(`[送仓管理] 自动更新柜号失败 (delivery_id: ${serialized.delivery_id}):`, err?.message || err)
          }
        }
      }

      return {
        delivery_id: String(serialized.delivery_id || ''),
        // ========== 送仓管理显示字段 ==========
        appointment_number: appointment?.reference_number || null,
        container_number: containerNumber,
        delivery_date: deliveryDate,
        origin_location: appointment?.locations_delivery_appointments_origin_location_idTolocations?.location_code || null,
        origin_location_id: appointment?.origin_location_id ? String(appointment.origin_location_id) : null,
        destination_location: appointment?.locations?.location_code || null,
        destination_location_id: appointment?.location_id ? String(appointment.location_id) : null,
        po: po,
        pallet_type: appointment?.appointment_type || null, // 地板/卡板
        delivery_method: appointment?.delivery_method || null, // 直送/卡派
        warehouse_account: order?.warehouse_account || null,
        appointment_time: deliveryDate,
        driver_name: serialized.drivers?.contact_roles?.name || serialized.drivers?.driver_code || null,
        driver_id: serialized.driver_id ? String(serialized.driver_id) : null,
        rejected: appointment?.rejected || false,
        // ========== 送仓管理自有字段 ==========
        status: serialized.status || null,
        notes: serialized.notes || null,
        // ========== 额外信息 ==========
        appointment_id: appointment ? String(appointment.appointment_id || '') : null,
        created_at: serialized.created_at || null,
        updated_at: serialized.updated_at || null,
      }
    }))

    return NextResponse.json({
      data: serializedDeliveries,
      total,
      page,
      limit,
    })
  } catch (error: any) {
    console.error('获取送仓管理列表失败:', error)
    return NextResponse.json(
      {
        error: error.message || '获取送仓管理列表失败',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

