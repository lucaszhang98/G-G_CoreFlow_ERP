/**
 * 库存预测计算 API（手动触发）
 * POST /api/reports/inventory-forecast/calculate
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/api/helpers'
import { calculateInventoryForecast } from '@/lib/services/inventory-forecast-service'

export async function POST(request: NextRequest) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    // 检查权限（只有管理员可以手动触发计算）
    if (authResult.user?.role !== 'admin') {
      return NextResponse.json(
        { error: '权限不足，只有管理员可以手动触发计算' },
        { status: 403 }
      )
    }

    // 获取前端传递的基准日期和时间戳（不进行时区转换，原样使用）
    const body = await request.json().catch(() => ({}))
    const { base_date, timestamp } = body

    console.log('[库存预测] 手动触发计算...')
    if (base_date) {
      console.log(`[库存预测] 使用基准日期: ${base_date}`)
    }
    if (timestamp) {
      console.log(`[库存预测] 使用时间戳: ${timestamp}`)
    }
    
    await calculateInventoryForecast(base_date, timestamp)
    console.log('[库存预测] 手动计算完成')

    return NextResponse.json({
      success: true,
      message: '库存预测计算完成',
    })
  } catch (error: any) {
    console.error('库存预测计算失败:', error)
    return NextResponse.json(
      {
        error: error.message || '库存预测计算失败',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

