/**
 * 运营追踪 API
 * 汇总订单、入库管理、送仓管理等关键信息
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { serializeBigInt } from "@/lib/api/helpers"

// 计算天数差（日期1 - 日期2，只比较日期部分，忽略时间）
function calculateDays(date1: Date | string | null, date2: Date | string | null): number | null {
  if (!date1 || !date2) return null
  
  // 提取日期部分（YYYY-MM-DD），忽略时间
  function extractDateOnly(date: Date | string): string | null {
    if (date instanceof Date) {
      // 使用 UTC 日期部分，避免时区问题
      const year = date.getUTCFullYear()
      const month = String(date.getUTCMonth() + 1).padStart(2, '0')
      const day = String(date.getUTCDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    } else if (typeof date === 'string') {
      // 提取 YYYY-MM-DD 部分
      const match = date.match(/^(\d{4}-\d{2}-\d{2})/)
      return match ? match[1] : null
    }
    return null
  }
  
  const date1Str = extractDateOnly(date1)
  const date2Str = extractDateOnly(date2)
  
  if (!date1Str || !date2Str) return null
  
  // 解析为 UTC 日期（午夜），然后计算天数差
  const d1 = new Date(date1Str + 'T00:00:00.000Z')
  const d2 = new Date(date2Str + 'T00:00:00.000Z')
  
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null
  
  // 计算天数差
  const diffTime = d1.getTime() - d2.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get("page") || "1")
    const pageSize = parseInt(searchParams.get("pageSize") || "50")
    const operationMode = searchParams.get("operationMode") // 'unload' 或 'direct_delivery' 或 null（全部）
    const search = searchParams.get("search") || "" // 柜号模糊搜索
    const sortBy = searchParams.get("sortBy") || "" // 排序字段，如 unload_date
    const sortOrder = (searchParams.get("sortOrder") || "asc") as "asc" | "desc"
    const skip = (page - 1) * pageSize

    console.log("[Operations Tracking API] 开始查询数据，page:", page, "pageSize:", pageSize, "operationMode:", operationMode, "search:", search)

    // 构建查询条件
    // 注意：前端可能传递 'delivery'，需要转换为数据库中的 'direct_delivery'
    const where: any = {}
    if (operationMode) {
      where.operation_mode = operationMode === 'delivery' ? 'direct_delivery' : operationMode
    }
    
    // 柜号模糊搜索
    if (search && search.trim()) {
      where.order_number = {
        contains: search.trim(),
        mode: 'insensitive',
      }
    }

    // 筛选条件
    const filterCarrierId = searchParams.get("filter_carrier_id")
    if (filterCarrierId && filterCarrierId !== '__all__') {
      where.carrier_id = BigInt(filterCarrierId)
    }

    const filterPortLocationId = searchParams.get("filter_port_location_id")
    if (filterPortLocationId && filterPortLocationId !== '__all__') {
      where.port_location_id = BigInt(filterPortLocationId)
    }

    // 处理筛选参数（filter_ 开头）
    searchParams.forEach((value, key) => {
      if (key.startsWith('filter_')) {
        const field = key.replace('filter_', '')
        // 拆柜日期走 inbound_receipt.planned_unload_at，下面单独处理
        if (field === 'unload_date_from' || field === 'unload_date_to') return
        // 日期范围字段（_from 或 _to 结尾）
        if (field.endsWith('_from') || field.endsWith('_to')) {
          const baseField = field.replace(/_from$|_to$/, '')
          if (!where[baseField]) {
            where[baseField] = {}
          }
          if (field.endsWith('_from')) {
            where[baseField].gte = new Date(value)
          } else {
            where[baseField].lte = new Date(value)
          }
        } else if (field === 'carrier_id' && value && value !== '__all__') {
          where.carrier_id = BigInt(value)
        } else if (field === 'port_location_id' && value && value !== '__all__') {
          where.port_location_id = BigInt(value)
        }
      }
    })

    // 拆柜日期筛选：来自 inbound_receipt.planned_unload_at。仅设起、未设止时（显示最近一月）包含未填拆柜日期的记录
    const unloadDateFrom = searchParams.get('filter_unload_date_from')
    const unloadDateTo = searchParams.get('filter_unload_date_to')
    if (unloadDateFrom || unloadDateTo) {
      if (unloadDateFrom && !unloadDateTo) {
        where.AND = where.AND || []
        where.AND.push({
          OR: [
            { inbound_receipt: { planned_unload_at: { gte: new Date(unloadDateFrom) } } },
            { inbound_receipt: { planned_unload_at: null } },
          ],
        })
      } else {
        where.inbound_receipt = where.inbound_receipt || {}
        where.inbound_receipt.planned_unload_at = where.inbound_receipt.planned_unload_at || {}
        if (unloadDateFrom) where.inbound_receipt.planned_unload_at.gte = new Date(unloadDateFrom)
        if (unloadDateTo) where.inbound_receipt.planned_unload_at.lte = new Date(unloadDateTo)
      }
    }

    // 高级搜索条件
    const advancedSearch: Record<string, any> = {}
    const advancedLogic = searchParams.get("advanced_logic") || 'AND'
    
    // 收集所有高级搜索参数
    searchParams.forEach((value, key) => {
      if (key.startsWith('advanced_') && key !== 'advanced_logic') {
        const field = key.replace('advanced_', '')
        advancedSearch[field] = value
      }
    })

    // 处理高级搜索条件
    if (Object.keys(advancedSearch).length > 0) {
      const advancedConditions: any[] = []
      
      Object.entries(advancedSearch).forEach(([field, value]) => {
        if (!value || value === '') return
        
        if (field === 'container_number') {
          // 柜号模糊搜索
          advancedConditions.push({
            order_number: {
              contains: value,
              mode: 'insensitive',
            },
          })
        } else if (field === 'carrier_id') {
          // 承运公司
          advancedConditions.push({
            carrier_id: BigInt(value),
          })
        } else if (field === 'port_location_id') {
          // 码头
          advancedConditions.push({
            port_location_id: BigInt(value),
          })
        } else if (field.endsWith('_from') || field.endsWith('_to')) {
          // 日期范围字段
          const baseField = field.replace(/_from$|_to$/, '')
          if (!where[baseField]) {
            where[baseField] = {}
          }
          if (field.endsWith('_from')) {
            where[baseField].gte = new Date(value)
          } else {
            where[baseField].lte = new Date(value)
          }
        }
      })

      // 根据逻辑组合高级搜索条件
      if (advancedConditions.length > 0) {
        if (advancedLogic === 'OR') {
          where.OR = advancedConditions
        } else {
          // AND 逻辑：合并到 where 对象中
          Object.assign(where, ...advancedConditions)
        }
      }
    }

    // 查询订单及其关联数据
    const [orders, total] = await Promise.all([
      prisma.orders.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          carriers: {
            select: {
              carrier_id: true,
              name: true,
              carrier_code: true,
            },
          },
          locations_orders_port_location_idTolocations: {
            select: {
              location_id: true,
              location_code: true,
              name: true,
            },
          },
          inbound_receipt: {
            select: {
              inbound_receipt_id: true,
              planned_unload_at: true,
            },
          },
          pickup_management: {
            select: {
              pickup_id: true,
            },
          },
          delivery_appointments: {
            select: {
              appointment_id: true,
              reference_number: true,
              confirmed_start: true,
            },
            orderBy: {
              confirmed_start: 'desc',
            },
          },
          order_detail: {
            select: {
              id: true,
              order_id: true,
              delivery_location_id: true,
              delivery_nature: true,
              estimated_pallets: true,
              remaining_pallets: true,
              window_period: true,
              notes: true,
              po: true,
              locations_order_detail_delivery_location_idTolocations: {
                select: {
                  location_id: true,
                  location_code: true,
                  name: true,
                },
              },
              inventory_lots: {
                select: {
                  pallet_count: true,
                  remaining_pallet_count: true,
                },
              },
              appointment_detail_lines: {
                select: {
                  delivery_appointments: {
                    select: {
                      reference_number: true,
                      confirmed_start: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy:
          operationMode === "unload" && sortBy === "unload_date"
            ? { inbound_receipt: { planned_unload_at: sortOrder } }
            : { order_id: "desc" },
      }),
      prisma.orders.count({ where }),
    ])

    console.log("[Operations Tracking API] 查询完成，订单数量:", orders.length, "总数:", total)

    // 处理数据
    const items = orders.map((order) => {
      // 提取基本信息（直接使用数据库中的原始值，不做任何转换）
      const containerNumber = order.order_number
      const portCode = order.locations_orders_port_location_idTolocations?.location_code || null
      const carrierName = order.carriers?.name || null
      // 日期字段直接使用数据库原始值，让 serializeBigInt 处理序列化
      const etaDate = order.eta_date
      const lfdDate = order.lfd_date
      const pickupDate = order.pickup_date
      const unloadDate = order.inbound_receipt?.planned_unload_at || null
      // 送货进度：按明细 (实际板数-剩余板数)/实际板数 计算，剩余=0 为 100%，主行取各明细按板数加权平均
      const allLots = (order.order_detail || []).flatMap((d: any) => d.inventory_lots || [])
      let deliveryProgress: number | null = null
      if (allLots.length > 0) {
        let totalWeighted = 0
        let totalPallets = 0
        for (const lot of allLots) {
          const p = lot.pallet_count != null ? Number(lot.pallet_count) : 0
          const r = lot.remaining_pallet_count != null ? Number(lot.remaining_pallet_count) : 0
          if (p <= 0) continue
          const progress = r === 0 ? 100 : ((p - r) / p) * 100
          totalWeighted += progress * p
          totalPallets += p
        }
        if (totalPallets > 0) {
          deliveryProgress = Math.round((totalWeighted / totalPallets) * 100) / 100
        }
      }
      const returnDeadline = order.return_deadline

      // 计算时效字段（直接使用数据库返回的 Date 对象，不做额外转换）
      // 注意：etaDate, lfdDate, returnDeadline, unloadDate 是 DATE 类型，pickupDate 是 TIMESTAMPTZ 类型
      // 调试：记录第一条数据的日期值（仅用于调试）
      if (order.order_number === 'EGSU1866887') {
        console.log('[Operations Tracking] 调试日期值:', {
          order_number: order.order_number,
          eta_date: etaDate,
          eta_date_type: typeof etaDate,
          eta_date_value: etaDate instanceof Date ? etaDate.toISOString() : etaDate,
          pickup_date: pickupDate,
          pickup_date_type: typeof pickupDate,
          pickup_date_value: pickupDate instanceof Date ? pickupDate.toISOString() : pickupDate,
          unload_date: unloadDate,
          unload_date_type: typeof unloadDate,
          unload_date_value: unloadDate instanceof Date ? unloadDate.toISOString() : unloadDate,
          return_deadline: returnDeadline,
          return_deadline_type: typeof returnDeadline,
          return_deadline_value: returnDeadline instanceof Date ? returnDeadline.toISOString() : returnDeadline,
        })
      }
      
      const pickupLeadTime = calculateDays(pickupDate, etaDate) // 提柜时效 = 提柜日期 - ETA
      const unloadLeadTime = calculateDays(unloadDate, pickupDate) // 拆柜时效 = 拆柜日期 - 提柜日期
      const chassisDays = returnDeadline && pickupDate
        ? calculateDays(returnDeadline, pickupDate)! + 1 // 车架天数 = 还柜日期 - 提柜日期 + 1
        : null
      
      // 调试：记录计算结果
      if (order.order_number === 'EGSU1866887') {
        console.log('[Operations Tracking] 调试计算结果:', {
          order_number: order.order_number,
          pickup_lead_time: pickupLeadTime,
          unload_lead_time: unloadLeadTime,
          chassis_days: chassisDays,
        })
      }

      // 处理订单明细
      const details = order.order_detail.map((detail) => {
        // 仓点
        const locationCode =
          detail.locations_order_detail_delivery_location_idTolocations?.location_code || null

        // 拆柜板数（汇总所有 inventory_lots 的 pallet_count，与入库管理详情中的实际板数一致）
        // 注意：这里汇总的是所有 inventory_lots 的 pallet_count，对应入库管理详情页中显示的实际板数
        const unloadPallets = detail.inventory_lots && detail.inventory_lots.length > 0
          ? detail.inventory_lots.reduce((sum: number, lot: any) => sum + (lot.pallet_count || 0), 0)
          : null

        // 剩余板数
        const remainingPallets = detail.remaining_pallets

        // 窗口期
        const windowPeriod = detail.window_period

        // ISA（预约号码，从 appointment_detail_lines 取第一个）
        const isa =
          (detail.appointment_detail_lines && detail.appointment_detail_lines.length > 0)
            ? detail.appointment_detail_lines[0]?.delivery_appointments?.reference_number || null
            : null

        // 备注
        const notes = detail.notes

        // 送仓日期：从该明细对应的所有预约中，取最晚的 confirmed_start（只取日期部分）
        let deliveryDate: Date | string | null = null
        if (detail.appointment_detail_lines && detail.appointment_detail_lines.length > 0) {
          const confirmedStarts = detail.appointment_detail_lines
            .map((adl: any) => adl.delivery_appointments?.confirmed_start)
            .filter((date: any) => date != null)
          
          if (confirmedStarts.length > 0) {
            // 找到最晚的日期
            const latestDate = confirmedStarts.reduce((latest: Date | string, current: Date | string) => {
              const latestTime = latest instanceof Date ? latest.getTime() : new Date(latest).getTime()
              const currentTime = current instanceof Date ? current.getTime() : new Date(current).getTime()
              return currentTime > latestTime ? current : latest
            })
            deliveryDate = latestDate
          }
        }

        // 送仓时效：送仓日期 - 拆柜日期（使用明细的送仓日期和主行的拆柜日期）
        const deliveryLeadTime = deliveryDate && unloadDate
          ? calculateDays(deliveryDate, unloadDate)
          : null

        return {
          id: detail.id.toString(),
          order_id: detail.order_id?.toString() || null,
          location_code: locationCode,
          unload_pallets: unloadPallets,
          remaining_pallets: remainingPallets,
          window_period: windowPeriod,
          isa: isa,
          notes: notes,
          delivery_date: deliveryDate,
          delivery_lead_time: deliveryLeadTime,
        }
      })

      return {
        order_id: order.order_id.toString(),
        container_number: containerNumber,
        port_code: portCode,
        carrier_name: carrierName,
        // 日期字段直接使用原始值，让 serializeBigInt 处理（与其他API保持一致）
        eta_date: etaDate,
        lfd_date: lfdDate,
        pickup_date: pickupDate,
        unload_date: unloadDate,
        delivery_progress: deliveryProgress,
        return_deadline: returnDeadline,
        pickup_lead_time: pickupLeadTime,
        unload_lead_time: unloadLeadTime,
        chassis_days: chassisDays,
        details: details,
      }
    })

    return NextResponse.json({
      items: serializeBigInt(items),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error: any) {
    console.error("[Operations Tracking API] Error:", error)
    console.error("[Operations Tracking API] Error Stack:", error.stack)
    return NextResponse.json(
      { 
        error: "获取运营追踪数据失败", 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

