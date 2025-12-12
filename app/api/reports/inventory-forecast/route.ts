/**
 * 库存预测报表 API
 * GET /api/reports/inventory-forecast
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/api/helpers'
import prisma from '@/lib/prisma'
import { formatDateString, addDaysToDateString, compareDateStrings } from '@/lib/utils/timezone'

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
        // 使用最近一次计算的起始日期作为基准
        // formatDateString 现在使用 UTC 方法，可以正确处理 Date 对象
        queryStartDate = formatDateString(latestCalculation[0].min_date)
        if (endDateParam) {
          queryEndDate = formatDateString(endDateParam)
        } else if (latestCalculation[0].max_date) {
          // 使用最近一次计算的结束日期
          queryEndDate = formatDateString(latestCalculation[0].max_date)
        } else {
          // 如果没有结束日期，计算15天
          queryEndDate = addDaysToDateString(queryStartDate, 14)
        }
      } else {
        // 如果数据库中没有数据，返回空结果
        return NextResponse.json({
          data: [],
          summary: {
            total_locations: 0,
            date_range: {
              start: null,
              end: null,
            },
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

    const responseData = {
      data: Object.values(groupedByLocation),
      summary: {
        total_locations: Object.keys(groupedByLocation).length,
        date_range: {
          start: queryStartDate,
          end: queryEndDate,
        },
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

