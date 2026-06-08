import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkPermission } from '@/lib/api/helpers'
import { loadPersistedForecasts } from '@/lib/mail-assistant/forecast-persistence'

const bodySchema = z.object({
  containerNumbers: z.array(z.string().min(1)).max(2000),
})

export async function POST(request: NextRequest) {
  const perm = await checkPermission(['admin'])
  if (perm.error) return perm.error

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: '请提供 containerNumbers 数组' }, { status: 400 })
  }

  try {
    const forecasts = await loadPersistedForecasts(body.containerNumbers)
    return NextResponse.json({ forecasts })
  } catch (error) {
    console.error('forecast-cache error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '加载预报缓存失败' },
      { status: 500 }
    )
  }
}
