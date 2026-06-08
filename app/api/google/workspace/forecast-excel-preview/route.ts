import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/api/helpers'
import { buildGmailMessageWebUrl, downloadGmailAttachment } from '@/lib/google/gmail-forecast'
import { getGoogleWorkspaceConnectionStatus } from '@/lib/google/workspace-oauth'
import { buildExcelPreviewPayload } from '@/lib/mail-assistant/excel-preview'
import {
  buildImportDraftDownloadUrl,
  getImportDraftBuffer,
} from '@/lib/mail-assistant/forecast-persistence'
import { normalizeContainerNumber } from '@/lib/mail-assistant/forecast-template-profile'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const perm = await checkPermission(['admin'])
  if (perm.error) return perm.error

  const kind = request.nextUrl.searchParams.get('kind')
  const containerNumber = request.nextUrl.searchParams.get('containerNumber')?.trim()

  if (kind !== 'source' && kind !== 'import') {
    return NextResponse.json({ error: 'kind 须为 source 或 import' }, { status: 400 })
  }
  if (!containerNumber) {
    return NextResponse.json({ error: '缺少 containerNumber' }, { status: 400 })
  }

  const cn = normalizeContainerNumber(containerNumber)

  try {
    if (kind === 'source') {
      const status = await getGoogleWorkspaceConnectionStatus()
      if (!status.connected) {
        return NextResponse.json({ error: '尚未连接 Google 账号' }, { status: 400 })
      }

      const row = await prisma.mail_container_forecast.findUnique({
        where: { container_number: cn },
      })
      if (!row || row.status !== 'found' || !row.message_id || !row.attachment_id) {
        return NextResponse.json({ error: '暂无源预报记录' }, { status: 404 })
      }

      const buffer = await downloadGmailAttachment(row.message_id, row.attachment_id)
      const preview = buildExcelPreviewPayload(
        buffer,
        row.source_filename ?? `源预报_${cn}.xlsx`
      )

      return NextResponse.json({
        kind,
        containerNumber: cn,
        downloadUrl:
          row.source_download_url ??
          `/api/google/workspace/gmail/attachment?${new URLSearchParams({
            messageId: row.message_id,
            attachmentId: row.attachment_id,
            filename: row.source_filename ?? 'source.xlsx',
          }).toString()}`,
        gmailUrl: row.message_id
          ? buildGmailMessageWebUrl(row.message_id, status.email, row.thread_id)
          : undefined,
        ...preview,
      })
    }

    const cached = await getImportDraftBuffer(cn)
    if (!cached) {
      return NextResponse.json({ error: '暂无导入预报，请先完成源预报查找' }, { status: 404 })
    }

    const preview = buildExcelPreviewPayload(
      cached.buffer,
      `导入预报_${cn}.xlsx`
    )

    return NextResponse.json({
      kind,
      containerNumber: cn,
      downloadUrl: `${buildImportDraftDownloadUrl(cn)}&v=${cached.updatedAt.getTime()}`,
      warnings: cached.warnings,
      ...preview,
    })
  } catch (error) {
    console.error('forecast-excel-preview error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '预览失败' },
      { status: 500 }
    )
  }
}
