import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkMailAssistantPermission } from '@/lib/mail-assistant/mail-assistant-permissions'
import { canImportOrders } from '@/lib/orders/order-import-permissions'
import { importForecastDraftsToOrders } from '@/lib/mail-assistant/import-forecast-drafts-to-orders'

const bodySchema = z.object({
  containerNumbers: z.array(z.string().min(1)).min(1).max(30),
})

export async function POST(request: NextRequest) {
  const perm = await checkMailAssistantPermission()
  if (perm.error) return perm.error

  if (!canImportOrders(perm.user?.role)) {
    return NextResponse.json({ error: '无权限导入订单' }, { status: 403 })
  }

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json(
      { error: '请提供 containerNumbers 数组（1–30 个柜号）' },
      { status: 400 }
    )
  }

  try {
    const userId = perm.user?.id != null ? BigInt(perm.user.id) : null
    if (userId == null) {
      return NextResponse.json({ error: '无法识别当前用户' }, { status: 401 })
    }
    const result = await importForecastDraftsToOrders(body.containerNumbers, userId)

    if (result.success) {
      return NextResponse.json({
        ...result,
        successCount: result.imported ?? 0,
        errorCount: 0,
      })
    }

    return NextResponse.json({
      ...result,
      success: false,
      successCount: 0,
      errorCount: result.errors?.length ?? 1,
    })
  } catch (error) {
    console.error('forecast-import-to-orders error:', error)
    return NextResponse.json(
      {
        success: false,
        successCount: 0,
        errorCount: 1,
        errors: [
          {
            row: 0,
            field: 'system',
            message: error instanceof Error ? error.message : '导入失败',
          },
        ],
        message: error instanceof Error ? error.message : '导入失败',
      },
      { status: 500 }
    )
  }
}
