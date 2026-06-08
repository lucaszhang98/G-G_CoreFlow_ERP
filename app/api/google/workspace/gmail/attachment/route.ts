import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/api/helpers'
import { getGoogleWorkspaceConnectionStatus } from '@/lib/google/workspace-oauth'
import { downloadGmailAttachment } from '@/lib/google/gmail-forecast'

export async function GET(request: NextRequest) {
  const perm = await checkPermission(['admin'])
  if (perm.error) return perm.error

  const status = await getGoogleWorkspaceConnectionStatus()
  if (!status.connected) {
    return NextResponse.json({ error: '尚未连接 Google 账号' }, { status: 400 })
  }

  const messageId = request.nextUrl.searchParams.get('messageId')?.trim()
  const attachmentId = request.nextUrl.searchParams.get('attachmentId')?.trim()
  const filename = request.nextUrl.searchParams.get('filename')?.trim() || 'attachment.xlsx'

  if (!messageId || !attachmentId) {
    return NextResponse.json({ error: '缺少 messageId 或 attachmentId' }, { status: 400 })
  }

  try {
    const buffer = await downloadGmailAttachment(messageId, attachmentId)
    const safeName = filename.replace(/[^\w.\-()\u4e00-\u9fff]+/g, '_')
    const contentType = safeName.toLowerCase().endsWith('.xls')
      ? 'application/vnd.ms-excel'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`,
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (error) {
    console.error('gmail attachment download error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '下载附件失败' },
      { status: 500 }
    )
  }
}
