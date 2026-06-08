import { NextRequest, NextResponse } from 'next/server'
import { loadForecastFileBuffer } from '@/lib/mail-assistant/load-forecast-file-buffer'
import { verifyForecastFileToken } from '@/lib/mail-assistant/forecast-file-token'

/**
 * 供 Office Online 等外部查看器拉取 Excel（短时 token，无需登录 cookie）
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')?.trim()
  if (!token) {
    return NextResponse.json({ error: '缺少 token' }, { status: 400 })
  }

  const payload = verifyForecastFileToken(token)
  if (!payload) {
    return NextResponse.json({ error: '链接已失效' }, { status: 401 })
  }

  try {
    const { buffer, filename } = await loadForecastFileBuffer(
      payload.kind,
      payload.containerNumber
    )
    const safeName = filename.replace(/[^\w.\-()\u4e00-\u9fff]+/g, '_')
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(safeName)}`,
        'Cache-Control': 'private, max-age=60',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('public forecast-file error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '文件读取失败' },
      { status: 500 }
    )
  }
}
