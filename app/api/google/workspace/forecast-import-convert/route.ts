import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkMailAssistantPermission } from '@/lib/mail-assistant/mail-assistant-permissions'
import { getGoogleWorkspaceConnectionStatus } from '@/lib/google/workspace-oauth'
import { convertImportDraftsBatch } from '@/lib/mail-assistant/forecast-persistence'

const bodySchema = z.object({
  containerNumbers: z.array(z.string().min(1)).min(1).max(50),
})

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
    return NextResponse.json({ error: '请提供 containerNumbers 数组（1–50 个柜号）' }, { status: 400 })
  }

  try {
    const results = await convertImportDraftsBatch(body.containerNumbers, 2)
    return NextResponse.json({ results })
  } catch (error) {
    console.error('forecast-import-convert error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '转换源预报失败' },
      { status: 500 }
    )
  }
}
