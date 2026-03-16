/**
 * 库存预测报表 API
 * GET /api/reports/inventory-forecast
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/api/helpers'
import prisma from '@/lib/prisma'
import { formatDateString, addDaysToDateString } from '@/lib/utils/timezone'

export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get('start_date')
    const endDateParam = searchParams.get('end_date')

    // 确定查询日期范围：使用最近一次计算的日期范围
    let queryStartDate: string
    let queryEndDate: string
    
    if (startDateParam) {
      // 如果提供了 startDateParam，使用它
      queryStartDate = formatDateString(startDateParam)
      queryEndDate = endDateParam 
        ? formatDateString(endDateParam)
        : addDaysToDateString(queryStartDate, 14)
    } else {
      // 获取数据库中最新计算的日期范围（基于 calculated_at 最新的那批数据）
      // 这样可以确保基准日期和实际数据一致
      const latestCalculation = await prisma.$queryRaw<Array<{ 
        min_date: Date | null
        max_date: Date | null
      }>>`
        SELECT 
          MIN(forecast_date) as min_date,
          MAX(forecast_date) as max_date
        FROM analytics.inventory_forecast_daily
        WHERE calculated_at = (
          SELECT MAX(calculated_at) 
          FROM analytics.inventory_forecast_daily
        )
      `
      
      if (latestCalculation[0]?.min_date) {
        // 使用最近一次计算的起始日期作为基准，固定返回 15 天，避免“第 15 天为空”
        queryStartDate = formatDateString(latestCalculation[0].min_date)
        // 始终为「基准日 + 14」共 15 天，保证报表 15 列都有数据
        queryEndDate = addDaysToDateString(queryStartDate, 14)
      } else {
        // 如果数据库中没有数据，返回空结果
        return NextResponse.json({
          data: [],
          summary: {
            total_locations: 0,
            date_range: { start: null, end: null },
            server_today: formatDateString(new Date()),
            total_unload_by_day: Array(15).fill(0),
            total_delivery_by_day: Array(15).fill(0),
            remaining_total_by_day: Array(15).fill(0),
          },
        })
      }
    }

    // 查询汇总表数据（只查询最新一次计算的数据）
    const forecastData = await prisma.$queryRaw<Array<{
      forecast_id: bigint
      location_id: bigint | null
      location_group: string
      location_name: string
      forecast_date: Date
      historical_inventory: number
      planned_inbound: number
      planned_outbound: number
      forecast_inventory: number
      calculated_at: Date | null
    }>>`
      SELECT 
        forecast_id,
        location_id,
        location_group,
        location_name,
        forecast_date,
        historical_inventory,
        planned_inbound,
        planned_outbound,
        forecast_inventory,
        calculated_at
      FROM analytics.inventory_forecast_daily
      WHERE forecast_date >= ${queryStartDate}::DATE
        AND forecast_date <= ${queryEndDate}::DATE
        AND calculated_at = (
          SELECT MAX(calculated_at) 
          FROM analytics.inventory_forecast_daily
        )
      ORDER BY 
        CASE location_group
          WHEN 'amazon' THEN 1
          WHEN 'fedex' THEN 2
          WHEN 'ups' THEN 3
          WHEN 'private_warehouse' THEN 4
          WHEN 'hold' THEN 5
        END,
        location_id NULLS LAST,
        forecast_date
    `

    // 序列化 BigInt 和日期
    const serialized = forecastData.map((row) => ({
      ...row,
      forecast_id: String(row.forecast_id),
      location_id: row.location_id ? String(row.location_id) : null,
      forecast_date: formatDateString(row.forecast_date),
      calculated_at: row.calculated_at ? row.calculated_at.toISOString() : null,
    }))

    // 合计拆柜：与入库管理一致，只统计关联订单 operation_mode='unload' 的入库单，按拆柜日期分组计数（柜数）
    const unloadByDate = await prisma.$queryRaw<Array<{ d: Date; total: string | number }>>`
      SELECT (r.planned_unload_at)::date AS d, COUNT(r.inbound_receipt_id)::bigint AS total
      FROM wms.inbound_receipt r
      INNER JOIN public.orders o ON o.order_id = r.order_id AND o.operation_mode = 'unload'
      WHERE r.planned_unload_at::date >= ${queryStartDate}::date
        AND r.planned_unload_at::date <= ${queryEndDate}::date
      GROUP BY (r.planned_unload_at)::date
    `
    // 合计送仓：预约管理自提/卡派；日期范围含 queryStartDate 到 queryEndDate+1，便于日视图「列 D 显示 D+1」且周视图「第k周」含当周一到周日
    const deliveryEndInclusive = addDaysToDateString(queryEndDate, 1)
    const deliveryByDate = await prisma.$queryRaw<Array<{ d: Date; total: string | number }>>`
      SELECT (COALESCE(d.confirmed_start, d.requested_start))::date AS d, COUNT(d.appointment_id)::bigint AS total
      FROM oms.delivery_appointments d
      WHERE d.delivery_method IN ('自提', '卡派')
        AND (d.confirmed_start IS NOT NULL OR d.requested_start IS NOT NULL)
        AND (COALESCE(d.confirmed_start, d.requested_start))::date >= ${queryStartDate}::date
        AND (COALESCE(d.confirmed_start, d.requested_start))::date <= ${deliveryEndInclusive}::date
      GROUP BY (COALESCE(d.confirmed_start, d.requested_start))::date
    `

    // 按仓点分组，便于前端展示
    const groupedByLocation = serialized.reduce((acc, row) => {
      const key = `${row.location_group}_${row.location_id || 'null'}`
      if (!acc[key]) {
        acc[key] = {
          location_id: row.location_id,
          location_group: row.location_group,
          location_name: row.location_name,
          daily_data: [],
        }
      }
      
      // 计算 day_number（相对于基准日期 queryStartDate）
      // 直接比较日期字符串，计算天数差
      const forecastDateStr = row.forecast_date
      const [year1, month1, day1] = queryStartDate.split('-').map(Number)
      const [year2, month2, day2] = forecastDateStr.split('-').map(Number)
      const startDateObj = new Date(year1, month1 - 1, day1)
      const forecastDateObj = new Date(year2, month2 - 1, day2)
      const dayNumber = Math.floor((forecastDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)) + 1
      
      acc[key].daily_data.push({
        forecast_date: row.forecast_date,
        day_number: dayNumber,
        historical_inventory: row.historical_inventory,
        planned_inbound: row.planned_inbound,
        planned_outbound: row.planned_outbound,
        forecast_inventory: row.forecast_inventory,
      })
      return acc
    }, {} as Record<string, any>)

    // 按日期的拆柜/送仓 Map（日期字符串 -> 数量）
    const unloadMap: Record<string, number> = {}
    unloadByDate.forEach((row) => {
      unloadMap[formatDateString(row.d)] = Number(row.total ?? 0)
    })
    const deliveryMap: Record<string, number> = {}
    deliveryByDate.forEach((row) => {
      deliveryMap[formatDateString(row.d)] = Number(row.total ?? 0)
    })

    // 按实际日期范围生成汇总数组（日视图 15 天，周视图 56 天等）
    const totalDays = (() => {
      const [y1, m1, d1] = queryStartDate.split('-').map(Number)
      const [y2, m2, d2] = queryEndDate.split('-').map(Number)
      const date1 = new Date(y1, m1 - 1, d1)
      const date2 = new Date(y2, m2 - 1, d2)
      return Math.round((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24)) + 1
    })()
    const total_unload_by_day: number[] = []
    const total_delivery_by_day: number[] = []
    for (let i = 0; i < totalDays; i++) {
      const dateStr = addDaysToDateString(queryStartDate, i)
      total_unload_by_day.push(unloadMap[dateStr] ?? 0)
    }
    for (let j = 0; j <= totalDays; j++) {
      const deliveryDateStr = addDaysToDateString(queryStartDate, j)
      total_delivery_by_day.push(deliveryMap[deliveryDateStr] ?? 0)
    }

    // 剩余总板数：按天各仓点 forecast_inventory 之和
    const remaining_total_by_day: number[] = []
    for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
      const sum = (Object.values(groupedByLocation) as Array<{ daily_data: Array<{ day_number: number; forecast_inventory: number }> }>).reduce(
        (s, loc) => {
          const dayData = loc.daily_data?.find((d) => d.day_number === dayNum)
          return s + (dayData?.forecast_inventory ?? 0)
        },
        0
      )
      remaining_total_by_day.push(sum)
    }

    // 服务器当前日期，用于前端高亮「今天」列
    const serverToday = formatDateString(new Date())

    const responseData = {
      data: Object.values(groupedByLocation),
      summary: {
        total_locations: Object.keys(groupedByLocation).length,
        date_range: {
          start: queryStartDate,
          end: queryEndDate,
        },
        server_today: serverToday,
        total_unload_by_day,
        total_delivery_by_day,
        remaining_total_by_day,
      },
    }
    
    console.log('[API] 返回的数据摘要:', {
      queryStartDate,
      queryEndDate,
      total_locations: responseData.summary.total_locations,
      firstLocationDailyDataCount: responseData.data[0]?.daily_data?.length,
      firstLocationFirstDay: responseData.data[0]?.daily_data?.[0],
      firstLocationLastDay: responseData.data[0]?.daily_data?.[responseData.data[0]?.daily_data?.length - 1],
    })
    
    return NextResponse.json(responseData)
  } catch (error: any) {
    console.error('获取库存预测数据失败:', error)
    return NextResponse.json(
      {
        error: error.message || '获取库存预测数据失败',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

