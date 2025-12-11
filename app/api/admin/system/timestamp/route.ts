/**
 * 系统时间戳管理 API（管理员）
 * POST /api/admin/system/timestamp - 更新或设置系统时间戳
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/api/helpers'
import { updateSystemTimestamp, setSystemTimestamp } from '@/lib/services/system-timestamp-service'

export async function POST(request: NextRequest) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    // 只有管理员可以更新系统时间戳
    if (authResult.user?.role !== 'admin') {
      return NextResponse.json(
        { error: '权限不足，只有管理员可以更新系统时间戳' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { action, timestamp, interval_minutes } = body

    let updatedTimestamp: Date

    if (action === 'set') {
      // 设置系统时间戳（用于初始设置或手动调整）
      updatedTimestamp = await setSystemTimestamp(timestamp)
    } else if (action === 'update') {
      // 更新系统时间戳（在原有时间基础上增加时间间隔）
      const interval = interval_minutes || 30 // 默认 30 分钟
      updatedTimestamp = await updateSystemTimestamp(interval)
    } else {
      return NextResponse.json(
        { error: '无效的操作类型，支持的操作：set（设置）、update（更新）' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      system_timestamp: updatedTimestamp.toISOString(),
      message: `系统时间戳已${action === 'set' ? '设置' : '更新'}为: ${updatedTimestamp.toISOString()}`,
    })
  } catch (error: any) {
    console.error('更新系统时间戳失败:', error)
    return NextResponse.json(
      {
        error: error.message || '更新系统时间戳失败',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

