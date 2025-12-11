/**
 * 库存预测计算 API（手动触发）
 * POST /api/reports/inventory-forecast/calculate
 * 
 * 注意：此函数可能需要较长时间执行，已设置最大超时时间为 26 秒（Netlify 免费版最大）
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/api/helpers'
import { calculateInventoryForecast } from '@/lib/services/inventory-forecast-service'

// 设置函数最大执行时间（Netlify 免费版最大 26 秒）
export const maxDuration = 26

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

    const startTime = Date.now()
    console.log('[库存预测] 手动触发计算...', {
      base_date,
      timestamp,
      environment: process.env.NODE_ENV,
    })
    
    try {
      await calculateInventoryForecast(base_date, timestamp)
      const duration = Date.now() - startTime
      console.log(`[库存预测] 手动计算完成，耗时: ${duration}ms`)

      return NextResponse.json({
        success: true,
        message: '库存预测计算完成',
        duration: `${(duration / 1000).toFixed(2)}秒`,
      })
    } catch (calcError: any) {
      const duration = Date.now() - startTime
      console.error('[库存预测] 计算过程失败:', {
        error: calcError.message,
        stack: calcError.stack,
        duration: `${(duration / 1000).toFixed(2)}秒`,
        base_date,
        timestamp,
      })
      throw calcError
    }
  } catch (error: any) {
    const errorMessage = error.message || '库存预测计算失败'
    const errorDetails = {
      message: errorMessage,
      // 在生产环境也记录详细错误，但不在响应中返回
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      // 如果是超时错误，提供更友好的提示
      isTimeout: errorMessage.includes('timeout') || errorMessage.includes('timed out') || errorMessage.includes('502'),
    }
    
    console.error('[库存预测] API 错误:', errorDetails)
    
    // 如果是超时错误，返回 504（Gateway Timeout）
    if (errorDetails.isTimeout) {
      return NextResponse.json(
        {
          error: '计算超时，请稍后重试。如果问题持续，请联系管理员。',
          code: 'TIMEOUT',
        },
        { status: 504 }
      )
    }
    
    return NextResponse.json(
      {
        error: errorMessage,
        code: 'CALCULATION_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

