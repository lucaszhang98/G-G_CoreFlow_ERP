/**
 * 库存预测计算服务
 * 负责计算和更新库存预测日报表数据
 * 
 * 🌍 时区处理：
 * - 系统统一使用 'America/Los_Angeles' 时区（PST/PDT）
 * - PostgreSQL 的 AT TIME ZONE 会自动处理夏令时/冬令时的切换
 * - PST（太平洋标准时间，UTC-8）：冬令时，通常在 11 月第一个星期日到 3 月第二个星期日
 * - PDT（太平洋夏令时，UTC-7）：夏令时，通常在 3 月第二个星期日到 11 月第一个星期日
 * - 系统无需手动干预，PostgreSQL 会根据日期自动应用正确的时区偏移
 */

import prisma from '@/lib/prisma'
import { formatDateString, addDaysToDateString } from '@/lib/utils/timezone'

interface LocationRow {
  location_id: bigint | null
  location_group: 'amazon' | 'fedex' | 'ups' | 'private_warehouse' | 'detained'
  location_name: string
}

/**
 * 获取所有需要计算的仓点行
 */
export async function getAllLocationRows(): Promise<LocationRow[]> {
  const rows: LocationRow[] = []

  // 1. 获取所有亚马逊仓点
  // 从两个来源获取：
  // a) 所有 order_detail 中的仓点
  // b) 所有有 planned_unload_at 的入库单对应的仓点（确保不遗漏）
  // delivery_location 可能是 location_id（数字字符串）或 location_code（字符串）
  const amazonLocations = await prisma.$queryRaw<Array<{
    location_id: bigint
    location_code: string | null
    name: string
  }>>`
    SELECT DISTINCT l.location_id, l.location_code, l.name
    FROM (
      -- 从 order_detail 获取
      SELECT DISTINCT od.delivery_location
      FROM order_detail od
      WHERE od.delivery_location IS NOT NULL AND od.delivery_location != ''
      
      UNION
      
      -- 从有 planned_unload_at 的入库单获取
      SELECT DISTINCT od.delivery_location
      FROM wms.inbound_receipt ir
      INNER JOIN orders o ON ir.order_id = o.order_id
      INNER JOIN order_detail od ON o.order_id = od.order_id
      WHERE ir.planned_unload_at IS NOT NULL
        AND ir.status != 'cancelled'
        AND od.delivery_location IS NOT NULL
        AND od.delivery_location != ''
    ) all_locations
    INNER JOIN locations l ON (
      CASE 
        WHEN all_locations.delivery_location ~ '^[0-9]+$' THEN all_locations.delivery_location::bigint = l.location_id
        ELSE all_locations.delivery_location = l.location_code
      END
    )
    WHERE l.location_type = 'amazon'
    ORDER BY l.location_code
  `

  for (const location of amazonLocations) {
    rows.push({
      location_id: location.location_id,
      location_group: 'amazon',
      location_name: location.name || location.location_code || String(location.location_id),
    })
  }

  // 2. 获取 FEDEX（delivery_location = 'FEDEX'，匹配 locations 表）
  const fedexLocation = await prisma.locations.findFirst({
    where: {
      location_code: 'FEDEX',
      location_type: 'warehouse',
    },
    select: {
      location_id: true,
      location_code: true,
      name: true,
    },
  })

  if (fedexLocation) {
    rows.push({
      location_id: fedexLocation.location_id,
      location_group: 'fedex',
      location_name: fedexLocation.name || 'FEDEX',
    })
  }

  // 3. 获取 UPS（delivery_location = 'UPS'，匹配 locations 表）
  const upsLocation = await prisma.locations.findFirst({
    where: {
      location_code: 'UPS',
      location_type: 'warehouse',
    },
    select: {
      location_id: true,
      location_code: true,
      name: true,
    },
  })

  if (upsLocation) {
    rows.push({
      location_id: upsLocation.location_id,
      location_group: 'ups',
      location_name: upsLocation.name || 'UPS',
    })
  }

  // 4. 私仓（不需要 location_id）
  rows.push({
    location_id: null,
    location_group: 'private_warehouse',
    location_name: '私仓',
  })

  // 5. 扣货（不需要 location_id）
  rows.push({
    location_id: null,
    location_group: 'detained',
    location_name: '扣货',
  })

  return rows
}

/**
 * 计算历史库存（截至指定日期之前）
 * 
 * @param locationRow - 仓点行
 * @param beforeDateString - 日期字符串（YYYY-MM-DD），计算此日期之前的历史库存
 */
export async function calculateHistoricalInventory(
  locationRow: LocationRow,
  beforeDateString: string
): Promise<number> {
  const beforeDate = formatDateString(beforeDateString)
  if (locationRow.location_group === 'private_warehouse') {
    // 私仓：按 delivery_nature 汇总，但排除 UPS 和 FEDEX
    // UPS location_id = 30, FEDEX location_id = 31
    const result = await prisma.$queryRaw<Array<{ sum: bigint }>>`
      SELECT COALESCE(SUM(il.remaining_pallet_count), 0)::INTEGER as sum
      FROM wms.inventory_lots il
      INNER JOIN order_detail od ON il.order_detail_id = od.id
      WHERE od.delivery_nature = '私仓'
        AND od.delivery_location NOT IN ('30', '31', 'UPS', 'FEDEX')
        AND (il.received_date IS NULL OR il.received_date < ${beforeDate}::DATE)
        AND il.status = 'available'
    `
    return Number(result[0]?.sum || 0)
  }

  if (locationRow.location_group === 'detained') {
    // 扣货：按 delivery_nature 汇总
    const result = await prisma.$queryRaw<Array<{ sum: bigint }>>`
      SELECT COALESCE(SUM(il.remaining_pallet_count), 0)::INTEGER as sum
      FROM wms.inventory_lots il
      INNER JOIN order_detail od ON il.order_detail_id = od.id
      WHERE od.delivery_nature = '扣货'
        AND (il.received_date IS NULL OR il.received_date < ${beforeDate}::DATE)
        AND il.status = 'available'
    `
    return Number(result[0]?.sum || 0)
  }

  // 亚马逊/FEDEX/UPS：按 location_id 匹配（delivery_location 存的是 location_id 的字符串形式）
  if (!locationRow.location_id) return 0

  const result = await prisma.$queryRaw<Array<{ sum: bigint }>>`
    SELECT COALESCE(SUM(il.remaining_pallet_count), 0)::INTEGER as sum
    FROM wms.inventory_lots il
    INNER JOIN order_detail od ON il.order_detail_id = od.id
    WHERE od.delivery_location = ${String(locationRow.location_id)}
      AND (il.received_date IS NULL OR il.received_date < ${beforeDate}::DATE)
      AND il.status = 'available'
  `

  return Number(result[0]?.sum || 0)
}

/**
 * 计算预计入库（inbound_receipt.planned_unload_at = 指定日期）
 * 逻辑：
 * 1. 从 inbound_receipt 表开始，找到所有 planned_unload_at = 指定日期的入库单
 * 2. 对于每个入库单的订单明细：
 *    - 如果 inbound_receipt.status = 'received'（已入库），从 inventory_lots 中取实际板数
 *    - 如果未入库（status != 'received'），从 order_detail 中取预计板数
 */
/**
 * 计算预计入库
 * 
 * @param locationRow - 仓点行
 * @param dateString - 日期字符串（YYYY-MM-DD）
 */
export async function calculatePlannedInbound(
  locationRow: LocationRow,
  dateString: string
): Promise<number> {
  const date = formatDateString(dateString)
  if (locationRow.location_group === 'private_warehouse') {
    // 私仓：按 delivery_nature 汇总，但排除 UPS 和 FEDEX
    // UPS location_id = 30, FEDEX location_id = 31
    // 如果已入库（ir.status = 'received'），用 inventory_lots 的实际板数
    // 如果未入库，用 order_detail 的预计板数
    const result = await prisma.$queryRaw<Array<{ sum: bigint }>>`
      SELECT COALESCE(SUM(
        CASE 
          WHEN ir.status = 'received' AND il.remaining_pallet_count IS NOT NULL THEN il.remaining_pallet_count
          ELSE COALESCE(od.estimated_pallets, 0)
        END
      ), 0)::INTEGER as sum
      FROM wms.inbound_receipt ir
      INNER JOIN orders o ON ir.order_id = o.order_id
      INNER JOIN order_detail od ON o.order_id = od.order_id
      LEFT JOIN wms.inventory_lots il ON il.order_detail_id = od.id 
        AND il.status = 'available'
        AND il.inbound_receipt_id = ir.inbound_receipt_id
      WHERE DATE(ir.planned_unload_at) = ${date}::DATE
        AND od.delivery_nature = '私仓'
        AND od.delivery_location NOT IN ('30', '31', 'UPS', 'FEDEX')
        AND ir.status != 'cancelled'
    `
    return Number(result[0]?.sum || 0)
  }

  if (locationRow.location_group === 'detained') {
    // 扣货：按 delivery_nature 汇总
    // 如果已入库（ir.status = 'received'），用 inventory_lots 的实际板数
    // 如果未入库，用 order_detail 的预计板数
    const result = await prisma.$queryRaw<Array<{ sum: bigint }>>`
      SELECT COALESCE(SUM(
        CASE 
          WHEN ir.status = 'received' AND il.remaining_pallet_count IS NOT NULL THEN il.remaining_pallet_count
          ELSE COALESCE(od.estimated_pallets, 0)
        END
      ), 0)::INTEGER as sum
      FROM wms.inbound_receipt ir
      INNER JOIN orders o ON ir.order_id = o.order_id
      INNER JOIN order_detail od ON o.order_id = od.order_id
      LEFT JOIN wms.inventory_lots il ON il.order_detail_id = od.id 
        AND il.status = 'available'
        AND il.inbound_receipt_id = ir.inbound_receipt_id
      WHERE DATE(ir.planned_unload_at) = ${date}::DATE
        AND od.delivery_nature = '扣货'
        AND ir.status != 'cancelled'
    `
    return Number(result[0]?.sum || 0)
  }

  // 亚马逊/FEDEX/UPS：按 location_id 匹配（delivery_location 存的是 location_id 的字符串形式）
  // 如果已入库（ir.status = 'received'），用 inventory_lots 的实际板数
  // 如果未入库，用 order_detail 的预计板数
  if (!locationRow.location_id) return 0

  const result = await prisma.$queryRaw<Array<{ sum: bigint }>>`
    SELECT COALESCE(SUM(
      CASE 
        WHEN ir.status = 'received' AND il.remaining_pallet_count IS NOT NULL THEN il.remaining_pallet_count
        ELSE COALESCE(od.estimated_pallets, 0)
      END
    ), 0)::INTEGER as sum
    FROM wms.inbound_receipt ir
    INNER JOIN orders o ON ir.order_id = o.order_id
    INNER JOIN order_detail od ON o.order_id = od.order_id
    LEFT JOIN wms.inventory_lots il ON il.order_detail_id = od.id 
      AND il.status = 'available'
      AND il.inbound_receipt_id = ir.inbound_receipt_id
    WHERE DATE(ir.planned_unload_at) = ${date}::DATE
      AND od.delivery_location = ${String(locationRow.location_id)}
      AND ir.status != 'cancelled'
  `

  return Number(result[0]?.sum || 0)
}

/**
 * 计算预计出库
 * 
 * @param locationRow - 仓点行
 * @param dateString - 日期字符串（YYYY-MM-DD）
 */
export async function calculatePlannedOutbound(
  locationRow: LocationRow,
  dateString: string
): Promise<number> {
  const date = formatDateString(dateString)
  if (locationRow.location_group === 'private_warehouse') {
    // 私仓：按 delivery_nature 汇总，但排除 UPS 和 FEDEX
    // UPS location_id = 30, FEDEX location_id = 31
    const result = await prisma.$queryRaw<Array<{ sum: bigint }>>`
      SELECT COALESCE(SUM(adl.estimated_pallets), 0)::INTEGER as sum
      FROM oms.appointment_detail_lines adl
      INNER JOIN order_detail od ON adl.order_detail_id = od.id
      INNER JOIN oms.delivery_appointments da ON adl.appointment_id = da.appointment_id
      -- 使用 AT TIME ZONE 将 TIMESTAMPTZ 转换为 PST/PDT 时区，然后提取日期
      -- PostgreSQL 会自动处理夏令时/冬令时的切换（PST/PDT）
      WHERE DATE(da.confirmed_start AT TIME ZONE 'America/Los_Angeles') = ${date}::DATE
        AND od.delivery_nature = '私仓'
        AND od.delivery_location NOT IN ('30', '31', 'UPS', 'FEDEX')
        AND da.status = 'confirmed'
    `
    return Number(result[0]?.sum || 0)
  }

  if (locationRow.location_group === 'detained') {
    // 扣货：按 delivery_nature 汇总
    const result = await prisma.$queryRaw<Array<{ sum: bigint }>>`
      SELECT COALESCE(SUM(adl.estimated_pallets), 0)::INTEGER as sum
      FROM oms.appointment_detail_lines adl
      INNER JOIN order_detail od ON adl.order_detail_id = od.id
      INNER JOIN oms.delivery_appointments da ON adl.appointment_id = da.appointment_id
      -- 使用 AT TIME ZONE 将 TIMESTAMPTZ 转换为 PST/PDT 时区，然后提取日期
      -- PostgreSQL 会自动处理夏令时/冬令时的切换（PST/PDT）
      WHERE DATE(da.confirmed_start AT TIME ZONE 'America/Los_Angeles') = ${date}::DATE
        AND od.delivery_nature = '扣货'
        AND da.status = 'confirmed'
    `
    return Number(result[0]?.sum || 0)
  }

  // 亚马逊/FEDEX/UPS：按 location_id 匹配（delivery_location 存的是 location_id 的字符串形式）
  if (!locationRow.location_id) return 0

  const result = await prisma.$queryRaw<Array<{ sum: bigint }>>`
    SELECT COALESCE(SUM(adl.estimated_pallets), 0)::INTEGER as sum
    FROM oms.appointment_detail_lines adl
    INNER JOIN order_detail od ON adl.order_detail_id = od.id
    INNER JOIN oms.delivery_appointments da ON adl.appointment_id = da.appointment_id
      WHERE od.delivery_location = ${String(locationRow.location_id)}
      AND DATE(da.confirmed_start) = ${date}::DATE
      AND da.status = 'confirmed'
  `

  return Number(result[0]?.sum || 0)
}

/**
 * 清理指定日期范围内的旧数据（安全清理）
 * 只清理当前计算日期范围内的数据，不影响其他日期的历史数据
 */
/**
 * 清理指定日期范围内的旧数据（安全清理）
 * 只清理当前计算日期范围内的数据，不影响其他日期的历史数据
 * 
 * @param startDateString - 开始日期字符串（YYYY-MM-DD）
 * @param endDateString - 结束日期字符串（YYYY-MM-DD）
 */
async function cleanupOldForecastData(
  startDateString: string, 
  endDateString: string
): Promise<void> {
  const startDate = formatDateString(startDateString)
  const endDate = formatDateString(endDateString)
  
  console.log(`[库存预测] 清理旧数据: ${startDate} 至 ${endDate}`)
  
  // 先查询要删除的数据数量（用于日志）
  const countResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count
    FROM analytics.inventory_forecast_daily
    WHERE forecast_date >= ${startDate}::DATE
      AND forecast_date <= ${endDate}::DATE
  `
  const countToDelete = Number(countResult[0]?.count || 0)
  
  if (countToDelete > 0) {
    // 只清理指定日期范围内的数据，不影响其他日期的数据
    await prisma.$executeRaw`
      DELETE FROM analytics.inventory_forecast_daily
      WHERE forecast_date >= ${startDate}::DATE
        AND forecast_date <= ${endDate}::DATE
    `
    console.log(`[库存预测] 已清理 ${countToDelete} 条旧数据`)
  } else {
    console.log(`[库存预测] 无需清理，范围内无旧数据`)
  }
}

/**
 * 计算并更新库存预测数据（15天）
 * 
 * 核心原则：不读取外界时间，所有日期都应该是系统内部约定的
 * 
 * @param baseDateString - 基准日期字符串（YYYY-MM-DD），如果不提供，则从数据库获取最后一次计算的日期
 */
/**
 * 计算库存预测
 * 
 * @param baseDateString - 基准日期字符串（YYYY-MM-DD），如果不提供则必须从 system_config 获取
 * @param timestampString - 时间戳字符串（YYYY-MM-DDTHH:mm:ss），用于 calculated_at 字段，如果不提供则使用 baseDateString + 00:00:00
 */
export async function calculateInventoryForecast(
  baseDateString?: string,
  timestampString?: string
): Promise<void> {
  // 确定基准日期：优先使用传入的日期，否则使用业务日期
  let baseDate: string
  
  if (baseDateString) {
    // 使用传入的日期（来自前端，不进行时区转换）
    baseDate = formatDateString(baseDateString)
  } else {
    // 如果没有传入日期，使用业务日期作为基准（从 system_config 表获取）
    const businessDateResult = await prisma.$queryRaw<Array<{ business_date: Date }>>`
      SELECT public.get_current_business_date() as business_date
    `
    
    if (businessDateResult[0]?.business_date) {
      baseDate = formatDateString(businessDateResult[0].business_date)
    } else {
      // 如果业务日期未配置，抛出错误，不允许使用外部时间
      throw new Error('业务日期未配置，请先设置业务日期。系统不允许读取外部时间。')
    }
  }
  
  // 确定时间戳：优先使用传入的时间戳，否则使用基准日期 + 00:00:00
  let calculatedTimestamp: Date
  if (timestampString) {
    // 使用传入的时间戳（来自前端，不进行时区转换）
    // 将字符串解析为 Date 对象，直接当作 UTC 时间
    calculatedTimestamp = new Date(timestampString + 'Z') // 添加 Z 表示 UTC
  } else {
    // 如果没有传入时间戳，使用基准日期 + 00:00:00
    calculatedTimestamp = new Date(baseDate + 'T00:00:00Z')
  }

  // 计算日期范围：基准日期到未来14天（共15天）
  const startDate = baseDate
  const endDate = addDaysToDateString(baseDate, 14)

  console.log(`[库存预测] 开始计算，基准日期: ${startDate}`)
  console.log(`[库存预测] 计算范围: ${startDate} 至 ${endDate}`)

  // 0. 清空整个预测表（每次重新计算都清空，确保数据干净）
  console.log(`[库存预测] 清空预测表所有数据...`)
  await prisma.$executeRaw`
    TRUNCATE TABLE analytics.inventory_forecast_daily
  `
  console.log(`[库存预测] 预测表已清空`)

  // 1. 获取所有仓点行
  const locationRows = await getAllLocationRows()
  console.log(`[库存预测] 找到 ${locationRows.length} 个仓点行`)

  // 2. 对每个仓点行，计算15天的数据
  for (const locationRow of locationRows) {
    console.log(`[库存预测] 计算仓点: ${locationRow.location_name} (${locationRow.location_group})`)

    let previousDayInventory = 0

    for (let day = 0; day < 15; day++) {
      // 计算当前预测日期（基准日期 + day 天）
      const forecastDateString = addDaysToDateString(startDate, day)

      // 计算数据
      let historicalInventory: number
      if (day === 0) {
        // 第1天：计算截至基准日期前一天的历史库存
        const yesterdayString = addDaysToDateString(startDate, -1)
        historicalInventory = await calculateHistoricalInventory(locationRow, yesterdayString)
      } else {
        // 第2天及以后：使用前一天的预计库存
        historicalInventory = previousDayInventory
      }

      const plannedInbound = await calculatePlannedInbound(locationRow, forecastDateString)
      const plannedOutbound = await calculatePlannedOutbound(locationRow, forecastDateString)
      const forecastInventory = historicalInventory + plannedInbound - plannedOutbound

      // 确保预计库存不为负数
      const finalForecastInventory = Math.max(0, forecastInventory)

      // 调试日志（仅对私仓和扣货）
      if (locationRow.location_group === 'private_warehouse' || locationRow.location_group === 'detained') {
        console.log(`[库存预测] ${locationRow.location_name} ${forecastDateString}: 历史=${historicalInventory}, 入库=${plannedInbound}, 出库=${plannedOutbound}, 预计=${finalForecastInventory}`)
      }

      // 写入表（使用 ON CONFLICT 确保数据一致性，即使有并发也不会重复）
      // 注意：calculated_at 使用传入的时间戳（来自前端，不进行时区转换）
      await prisma.$executeRaw`
        INSERT INTO analytics.inventory_forecast_daily (
          location_id,
          location_group,
          location_name,
          forecast_date,
          historical_inventory,
          planned_inbound,
          planned_outbound,
          forecast_inventory,
          calculated_at,
          calculation_version
        ) VALUES (
          ${locationRow.location_id},
          ${locationRow.location_group},
          ${locationRow.location_name},
          ${forecastDateString}::DATE,
          ${historicalInventory},
          ${plannedInbound},
          ${plannedOutbound},
          ${finalForecastInventory},
          ${calculatedTimestamp}::TIMESTAMPTZ,
          1
        )
        ON CONFLICT (location_id, location_group, forecast_date)
        DO UPDATE SET
          historical_inventory = EXCLUDED.historical_inventory,
          planned_inbound = EXCLUDED.planned_inbound,
          planned_outbound = EXCLUDED.planned_outbound,
          forecast_inventory = EXCLUDED.forecast_inventory,
          calculated_at = ${calculatedTimestamp}::TIMESTAMPTZ
      `

      previousDayInventory = finalForecastInventory
    }

    console.log(`[库存预测] 完成仓点: ${locationRow.location_name}`)
  }

  console.log(`[库存预测] 计算完成`)
}

