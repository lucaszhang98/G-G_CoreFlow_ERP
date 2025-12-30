/**
 * 获取服务器当前时间 API
 * GET /api/system/current-time
 * 
 * 返回服务器当前时间（UTC），用于前端计算和显示
 * 这样可以确保所有用户使用相同的基准时间，不受浏览器时区影响
 * 
 * 本地开发：返回本地开发服务器的时间
 * 正式环境：返回 Netlify 服务器的时间
 * 代码逻辑完全一样，只是服务器不同
 */

import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // 获取服务器当前时间（UTC）
    const now = new Date()
    
    // 格式化为 YYYY-MM-DDTHH:mm:ss 格式（UTC）
    const year = now.getUTCFullYear()
    const month = String(now.getUTCMonth() + 1).padStart(2, '0')
    const day = String(now.getUTCDate()).padStart(2, '0')
    const hours = String(now.getUTCHours()).padStart(2, '0')
    const minutes = String(now.getUTCMinutes()).padStart(2, '0')
    const seconds = String(now.getUTCSeconds()).padStart(2, '0')
    
    // 日期部分（YYYY-MM-DD）
    const dateString = `${year}-${month}-${day}`
    // 完整时间戳（YYYY-MM-DDTHH:mm:ss）
    const timestampString = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
    
    return NextResponse.json({
      date: dateString,
      timestamp: timestampString,
      iso: now.toISOString(),
      // 同时返回 Unix 时间戳（毫秒）
      unix: now.getTime(),
    })
  } catch (error: any) {
    console.error('获取服务器时间失败:', error)
    return NextResponse.json(
      {
        error: '获取服务器时间失败',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
