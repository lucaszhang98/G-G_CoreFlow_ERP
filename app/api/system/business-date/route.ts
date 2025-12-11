/**
 * 业务日期 API
 * GET /api/system/business-date - 获取当前业务日期
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/api/helpers'
import { getCurrentBusinessDate, getBusinessDateConfig } from '@/lib/services/business-date-service'

export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    const config = await getBusinessDateConfig()

    return NextResponse.json({
      business_date: config.business_date,
      updated_at: config.updated_at,
      updated_by: config.updated_by,
    })
  } catch (error: any) {
    console.error('获取业务日期失败:', error)
    return NextResponse.json(
      {
        error: error.message || '获取业务日期失败',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

