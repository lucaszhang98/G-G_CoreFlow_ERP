import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/api/helpers'
import { getGoogleWorkspaceConnectionStatus } from '@/lib/google/workspace-oauth'
import {
  getImportDraftBuffer,
  saveImportDraftMatrix,
} from '@/lib/mail-assistant/forecast-persistence'
import { trimImportEditableRows } from '@/lib/mail-assistant/import-draft-matrix'
import { generateOrderImportDraftFromSource } from '@/lib/mail-assistant/generate-order-import-draft'
import { buildImportDraftDownloadUrl } from '@/lib/mail-assistant/forecast-persistence'
import { normalizeContainerNumber } from '@/lib/mail-assistant/forecast-template-profile'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const perm = await checkPermission(['admin'])
  if (perm.error) return perm.error

  const status = await getGoogleWorkspaceConnectionStatus()
  if (!status.connected) {
    return NextResponse.json({ error: '尚未连接 Google 账号' }, { status: 400 })
  }

  const containerNumber = request.nextUrl.searchParams.get('containerNumber')?.trim()
  const messageId = request.nextUrl.searchParams.get('messageId')?.trim()
  const attachmentId = request.nextUrl.searchParams.get('attachmentId')?.trim()
  const sourceFilename =
    request.nextUrl.searchParams.get('sourceFilename')?.trim() || 'source.xlsx'

  // 优先：按柜号读持久化缓存（陈旧 1 行缓存会自动重生）
  if (containerNumber && !messageId) {
    const cn = normalizeContainerNumber(containerNumber)
    const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1'
    const cached = await getImportDraftBuffer(cn, { forceRefresh })
    if (cached) {
      return fileResponse(cached.buffer, cn, cached.warnings)
    }
    return NextResponse.json({ error: '暂无已缓存的导入预报，请先完成源预报查找' }, { status: 404 })
  }

  if (!messageId || !attachmentId || !containerNumber) {
    return NextResponse.json(
      { error: '缺少 containerNumber，或 messageId / attachmentId' },
      { status: 400 }
    )
  }

  try {
    const { buffer, warnings } = await generateOrderImportDraftFromSource({
      containerNumber,
      messageId,
      attachmentId,
      filename: sourceFilename,
    })

    const cn = normalizeContainerNumber(containerNumber)
    await prisma.mail_container_forecast.updateMany({
      where: { container_number: cn },
      data: {
        import_draft_data: Uint8Array.from(buffer) as Uint8Array<ArrayBuffer>,
        import_draft_warnings: warnings.join('; ') || null,
        import_draft_download_url: buildImportDraftDownloadUrl(cn),
        updated_at: new Date(),
      },
    })

    return fileResponse(buffer, cn, warnings.join('; '))
  } catch (error) {
    console.error('forecast-import-draft error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成导入预报失败' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  const perm = await checkPermission(['admin'])
  if (perm.error) return perm.error

  const status = await getGoogleWorkspaceConnectionStatus()
  if (!status.connected) {
    return NextResponse.json({ error: '尚未连接 Google 账号' }, { status: 400 })
  }

  let body: { containerNumber?: string; rows?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '请求体无效' }, { status: 400 })
  }

  const containerNumber = body.containerNumber?.trim()
  if (!containerNumber) {
    return NextResponse.json({ error: '缺少 containerNumber' }, { status: 400 })
  }

  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json({ error: '缺少 rows' }, { status: 400 })
  }

  let rows: string[][]
  try {
    rows = body.rows.map((row) => {
      if (!Array.isArray(row)) throw new Error('rows 格式无效')
      return row.map((cell) => String(cell ?? ''))
    })
  } catch {
    return NextResponse.json({ error: 'rows 格式无效' }, { status: 400 })
  }

  try {
    const cn = normalizeContainerNumber(containerNumber)
    const result = await saveImportDraftMatrix(cn, trimImportEditableRows(rows))
    return NextResponse.json({
      ok: true,
      containerNumber: cn,
      detailRowCount: result.detailRowCount,
      fileVersion: result.updatedAt.getTime(),
    })
  } catch (error) {
    console.error('forecast-import-draft PUT error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '保存失败' },
      { status: 500 }
    )
  }
}

function fileResponse(buffer: Buffer, containerNumber: string, warnings: string) {
  const safeName = `导入预报_${containerNumber}.xlsx`.replace(/[^\w.\-\u4e00-\u9fff]+/g, '_')
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`,
      'X-Forecast-Warnings': encodeURIComponent(warnings),
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
