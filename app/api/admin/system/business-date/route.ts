/**
 * 业务日期管理 API（管理员）
 * POST /api/admin/system/business-date - 更新业务日期
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/api/helpers'
import { updateBusinessDate } from '@/lib/services/business-date-service'

export async function POST(request: NextRequest) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    // 只有管理员可以更新业务日期
    if (authResult.user?.role !== 'admin') {
      return NextResponse.json(
        { error: '权限不足，只有管理员可以更新业务日期' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { date } = body

    const updatedDate = await updateBusinessDate(date)

    return NextResponse.json({
      success: true,
      business_date: updatedDate,
      message: `业务日期已更新为: ${updatedDate}`,
    })
  } catch (error: any) {
    console.error('更新业务日期失败:', error)
    return NextResponse.json(
      {
        error: error.message || '更新业务日期失败',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

