import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkMailAssistantPermission } from '@/lib/mail-assistant/mail-assistant-permissions'
import { getGoogleWorkspaceConnectionStatus } from '@/lib/google/workspace-oauth'
import { convertImportDraftsBatch } from '@/lib/mail-assistant/forecast-persistence'

const itemSchema = z.object({
  containerNumber: z.string().min(1),
  orderDateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  customerCode: z.string().min(1).max(50).optional(),
})

const bodySchema = z.union([
  z.object({
    items: z.array(itemSchema).min(1).max(50),
  }),
  z.object({
    containerNumbers: z.array(z.string().min(1)).min(1).max(50),
  }),
])

export async function POST(request: NextRequest) {
  const perm = await checkMailAssistantPermission()
  if (perm.error) return perm.error

  const status = await getGoogleWorkspaceConnectionStatus()
  if (!status.connected) {
    return NextResponse.json(
      { error: '尚未连接 Google 账号，请先完成 OAuth 授权' },
      { status: 400 }
    )
  }

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json(
      { error: '请提供 items（含 containerNumber、orderDateKey）或 containerNumbers 数组' },
      { status: 400 }
    )
  }

  const items =
    'items' in body
      ? body.items
      : body.containerNumbers.map((containerNumber) => ({ containerNumber }))

  try {
    const results = await convertImportDraftsBatch(items, 2)
    return NextResponse.json({ results })
  } catch (error) {
    console.error('forecast-import-convert error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '转换源预报失败' },
      { status: 500 }
    )
  }
}
