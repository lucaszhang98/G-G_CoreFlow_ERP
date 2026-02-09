/**
 * GET /api/wms/inbound-receipts/batch-print/labels?ids=1,2,3
 * 批量生成 Label，返回合并后的单份 PDF（多页）
 */
import { NextRequest, NextResponse } from 'next/server'
import { checkAuth, checkPermission } from '@/lib/api/helpers'
import { inboundReceiptConfig } from '@/lib/crud/configs/inbound-receipts'
import { mergePdfBuffers } from '@/lib/services/print/merge-pdf'
import { getLabelsPdfBuffer } from '../../get-inbound-print-buffer'

export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error
    const permissionResult = await checkPermission(inboundReceiptConfig.permissions.list)
    if (permissionResult.error) return permissionResult.error

    const idsParam = request.nextUrl.searchParams.get('ids')
    if (!idsParam?.trim()) {
      return NextResponse.json({ error: '请提供 ids 参数，如 ids=1,2,3' }, { status: 400 })
    }
    const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean)
    if (ids.length === 0) {
      return NextResponse.json({ error: 'ids 不能为空' }, { status: 400 })
    }

    const results = await Promise.all(ids.map((id) => getLabelsPdfBuffer(id)))
    const buffers = results.filter((b): b is Buffer => b != null)
    if (buffers.length === 0) {
      return NextResponse.json(
        { error: '没有可用的入库单数据可生成 Label' },
        { status: 404 }
      )
    }

    const merged = await mergePdfBuffers(buffers)
    const filename = `批量-Label-${ids.length}份.pdf`
    return new NextResponse(merged as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
      },
    })
  } catch (error: any) {
    console.error('[Batch Labels]', error)
    return NextResponse.json(
      { error: error?.message || '批量生成 Label 失败' },
      { status: 500 }
    )
  }
}
