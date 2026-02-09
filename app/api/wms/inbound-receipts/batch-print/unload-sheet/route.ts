/**
 * GET /api/wms/inbound-receipts/batch-print/unload-sheet?ids=1,2,3
 * 批量生成拆柜单据，返回合并后的单份 PDF（多页）
 * 优化：1 次查询拉全量数据，仅 PDF 渲染并行。
 */
import { NextRequest, NextResponse } from 'next/server'
import { checkAuth, checkPermission } from '@/lib/api/helpers'
import { inboundReceiptConfig } from '@/lib/crud/configs/inbound-receipts'
import { mergePdfBuffers } from '@/lib/services/print/merge-pdf'
import { generateUnloadSheetPDF } from '@/lib/services/print/unload-sheet.service'
import { loadBatchUnloadSheetData } from '../../get-inbound-print-buffer'

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

    const dataList = await loadBatchUnloadSheetData(ids)
    const withData = dataList.filter((d): d is NonNullable<typeof d> => d != null)
    const buffers = await Promise.all(
      withData.map((d) =>
        generateUnloadSheetPDF(d).then((b) => (Buffer.isBuffer(b) ? b : Buffer.from(b as ArrayBuffer)))
      )
    )
    if (buffers.length === 0) {
      return NextResponse.json(
        { error: '没有可用的入库单数据可生成拆柜单据' },
        { status: 404 }
      )
    }

    const merged = await mergePdfBuffers(buffers)
    const filename = `批量-拆柜单据-${ids.length}份.pdf`
    return new NextResponse(merged as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
      },
    })
  } catch (error: any) {
    console.error('[Batch Unload Sheet]', error)
    return NextResponse.json(
      { error: error?.message || '批量生成拆柜单据失败' },
      { status: 500 }
    )
  }
}
