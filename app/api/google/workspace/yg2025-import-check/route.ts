import { NextResponse } from 'next/server'
import { checkMailAssistantPermission } from '@/lib/mail-assistant/mail-assistant-permissions'
import { getGoogleWorkspaceConnectionStatus } from '@/lib/google/workspace-oauth'
import { fetchYg2025ImportCheck } from '@/lib/google/oak-yg2025-sheet'

export async function GET() {
  const perm = await checkMailAssistantPermission()
  if (perm.error) return perm.error

  const status = await getGoogleWorkspaceConnectionStatus()
  if (!status.connected) {
    return NextResponse.json(
      { error: '尚未连接 Google 账号，请先完成 OAuth 授权' },
      { status: 400 }
    )
  }

  try {
    const result = await fetchYg2025ImportCheck()
    return NextResponse.json(result)
  } catch (error) {
    console.error('YG2025 import check error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '读取 Sheet 失败' },
      { status: 500 }
    )
  }
}
