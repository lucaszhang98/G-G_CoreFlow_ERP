/**
 * 定时任务：更新系统时间戳
 * GET /api/cron/update-system-timestamp
 * 
 * 用途：定时任务定期调用此 API，在原有时间基础上增加时间间隔
 * 更新频率：每 30 分钟
 * 
 * 部署平台：Netlify
 * 配置方式：在 Netlify 控制台配置 Scheduled Functions，指向此 API 端点
 * 
 * 安全：需要验证 CRON_SECRET（可选）
 * 环境控制：只有指定的环境才会执行（通过 ENABLE_CRON_ENV 环境变量控制）
 */

import { NextRequest, NextResponse } from 'next/server'
import { updateSystemTimestamp } from '@/lib/services/system-timestamp-service'

export async function GET(request: NextRequest) {
  try {
    // 环境检查：只有指定的环境才执行定时任务
    // 如果设置了 ENABLE_CRON_ENV，只有匹配的环境才执行
    const enableCronEnv = process.env.ENABLE_CRON_ENV
    // Netlify 使用 CONTEXT 环境变量：production, deploy-preview, branch-deploy
    const currentEnv = process.env.CONTEXT || process.env.NODE_ENV || 'development'
    
    if (enableCronEnv && currentEnv !== enableCronEnv) {
      return NextResponse.json({
        skipped: true,
        message: `定时任务已跳过：当前环境 ${currentEnv} 不匹配配置的环境 ${enableCronEnv}`,
        current_env: currentEnv,
        required_env: enableCronEnv,
      })
    }

    // 验证 cron secret（防止未授权访问）
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 从查询参数获取时间间隔（分钟），默认 30 分钟
    const { searchParams } = new URL(request.url)
    const intervalMinutes = searchParams.get('interval_minutes')
    const interval = intervalMinutes ? parseInt(intervalMinutes, 10) : 30

    if (isNaN(interval) || interval <= 0) {
      return NextResponse.json(
        { error: '无效的时间间隔，必须是正整数（分钟）' },
        { status: 400 }
      )
    }

    const updatedTimestamp = await updateSystemTimestamp(interval)

    return NextResponse.json({
      success: true,
      system_timestamp: updatedTimestamp.toISOString(),
      interval_minutes: interval,
      message: `系统时间戳已更新，增加了 ${interval} 分钟`,
    })
  } catch (error: any) {
    console.error('定时任务更新系统时间戳失败:', error)
    return NextResponse.json(
      {
        error: error.message || '定时任务更新系统时间戳失败',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

