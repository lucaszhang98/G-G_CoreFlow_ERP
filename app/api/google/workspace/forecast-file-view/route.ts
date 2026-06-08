import { NextRequest, NextResponse } from 'next/server'
import { checkMailAssistantPermission } from '@/lib/mail-assistant/mail-assistant-permissions'
import { getAppBaseUrl, getGoogleWorkspaceConnectionStatus } from '@/lib/google/workspace-oauth'
import { buildGmailMessageWebUrl, resolveGmailThreadId } from '@/lib/google/gmail-forecast'
import { signForecastFileToken } from '@/lib/mail-assistant/forecast-file-token'
import {
  buildImportDraftDownloadUrl,
  getImportDraftBuffer,
} from '@/lib/mail-assistant/forecast-persistence'
import { countImportDraftDetailRows } from '@/lib/mail-assistant/import-draft-buffer'
import { buildGmailAttachmentDownloadPath } from '@/lib/google/gmail-forecast'
import prisma from '@/lib/prisma'
import { normalizeContainerNumber } from '@/lib/mail-assistant/forecast-template-profile'

export async function GET(request: NextRequest) {
  const perm = await checkMailAssistantPermission()
  if (perm.error) return perm.error

  const kind = request.nextUrl.searchParams.get('kind')
  const containerNumber = request.nextUrl.searchParams.get('containerNumber')?.trim()

  if (kind !== 'source' && kind !== 'import') {
    return NextResponse.json({ error: 'kind 无效' }, { status: 400 })
  }
  if (!containerNumber) {
    return NextResponse.json({ error: '缺少 containerNumber' }, { status: 400 })
  }

  const cn = normalizeContainerNumber(containerNumber)
  const { email: workspaceEmail } = await getGoogleWorkspaceConnectionStatus()
  const row = await prisma.mail_container_forecast.findUnique({
    where: { container_number: cn },
  })

  if (!row || row.status !== 'found') {
    return NextResponse.json({ error: '暂无预报文件' }, { status: 404 })
  }

  let detailRowCount: number | undefined
  let fileUpdatedAt = row.updated_at.getTime()

  let downloadUrl =
    kind === 'import'
      ? row.import_draft_download_url ?? buildImportDraftDownloadUrl(cn)
      : row.source_download_url ??
        (row.message_id && row.attachment_id
          ? buildGmailAttachmentDownloadPath(
              row.message_id,
              row.attachment_id,
              row.source_filename ?? 'source.xlsx'
            )
          : null)

  if (kind === 'import') {
    const draft = await getImportDraftBuffer(cn)
    if (draft) {
      detailRowCount = countImportDraftDetailRows(draft.buffer)
      fileUpdatedAt = draft.updatedAt.getTime()
    }
  }

  if (!downloadUrl) {
    return NextResponse.json({ error: '暂无文件链接' }, { status: 404 })
  }

  if (kind === 'import') {
    const sep = downloadUrl.includes('?') ? '&' : '?'
    downloadUrl = `${downloadUrl}${sep}v=${fileUpdatedAt}`
  }

  const filename =
    kind === 'import'
      ? `导入预报_${cn}.xlsx`
      : row.source_filename ?? `源预报_${cn}.xlsx`

  const requestOrigin = request.nextUrl.origin
  const baseUrl = getAppBaseUrl() || requestOrigin
  const token = signForecastFileToken({ kind, containerNumber: cn })
  const publicFileUrl = `${baseUrl}/api/public/forecast-file?token=${encodeURIComponent(token)}`

  // 统一使用前端 SheetJS 内联预览（Office Online 需公网可拉取文件，正式环境常失败）
  const officeEmbedUrl = null

  let threadId = row.thread_id
  if (row.message_id && !threadId) {
    try {
      threadId = await resolveGmailThreadId(row.message_id)
    } catch (error) {
      console.warn(`resolveGmailThreadId failed for ${cn}:`, error)
    }
  }

  return NextResponse.json({
    kind,
    containerNumber: cn,
    filename,
    downloadUrl,
    gmailUrl: row.message_id
      ? buildGmailMessageWebUrl(row.message_id, workspaceEmail, threadId)
      : undefined,
    officeEmbedUrl,
    publicFileUrl,
    useOfficeViewer: false,
    editable: kind === 'import',
    detailRowCount,
    fileVersion: fileUpdatedAt,
  })
}
