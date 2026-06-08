import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/api/helpers'
import { getGoogleWorkspaceConnectionStatus } from '@/lib/google/workspace-oauth'
import { testGmailAccess } from '@/lib/google/gmail-api'
import { testSheetAccess } from '@/lib/google/sheets-api'

export async function POST(request: NextRequest) {
  const perm = await checkPermission(['admin'])
  if (perm.error) return perm.error

  const status = await getGoogleWorkspaceConnectionStatus()
  if (!status.connected) {
    return NextResponse.json(
      { error: '尚未连接 Google 账号，请先点击「连接 Google 账号」完成授权' },
      { status: 400 }
    )
  }

  let sheetUrl: string | undefined
  try {
    const body = await request.json()
    sheetUrl = typeof body?.sheetUrl === 'string' ? body.sheetUrl : undefined
  } catch {
    // body optional
  }

  let gmailResult: { ok: boolean; message: string; email?: string | null }
  try {
    const gmail = await testGmailAccess()
    gmailResult = gmail
  } catch (error) {
    gmailResult = {
      ok: false,
      message: error instanceof Error ? error.message : 'Gmail 测试失败',
    }
  }

  let sheetResult: {
    ok: boolean
    message: string
    title?: string
    rowCount?: number
    previewRows?: string[][]
  } | null = null

  if (sheetUrl?.trim()) {
    try {
      const sheet = await testSheetAccess(sheetUrl)
      if (sheet.ok) {
        sheetResult = {
          ok: true,
          message: sheet.message,
          title: sheet.title,
          rowCount: sheet.rowCount,
          previewRows: sheet.previewRows,
        }
      } else {
        sheetResult = { ok: false, message: sheet.message }
      }
    } catch (error) {
      sheetResult = {
        ok: false,
        message: error instanceof Error ? error.message : 'Sheet 测试失败',
      }
    }
  }

  return NextResponse.json({
    gmail: gmailResult,
    sheet: sheetResult,
    email: status.email,
  })
}
