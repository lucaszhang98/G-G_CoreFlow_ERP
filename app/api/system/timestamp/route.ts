/**
 * 系统时间戳 API
 * GET /api/system/timestamp - 获取当前系统时间戳
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/api/helpers'
import { getSystemTimestampConfig } from '@/lib/services/system-timestamp-service'

export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    const config = await getSystemTimestampConfig()

    return NextResponse.json({
      system_timestamp: config.system_timestamp,
      updated_at: config.updated_at,
      updated_by: config.updated_by,
    })
  } catch (error: any) {
    console.error('获取系统时间戳失败:', error)
    return NextResponse.json(
      {
        error: error.message || '获取系统时间戳失败',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

