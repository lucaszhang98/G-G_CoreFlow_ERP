/**
 * GET /api/wms/outbound-shipments/batch-print/loading-sheet?ids=1,2,3
 * 批量生成装车单，返回合并后的单份 PDF（多页）
 * 优化：2 次查询拉全量数据，logo 只解析一次，仅 PDF 渲染并行。
 */
import { NextRequest, NextResponse } from 'next/server'
import { checkAuth, checkPermission } from '@/lib/api/helpers'
import { outboundShipmentConfig } from '@/lib/crud/configs/outbound-shipments'
import { mergePdfBuffers } from '@/lib/services/print/merge-pdf'
import { resolveLogoDataUrl } from '@/lib/services/print/resolve-logo'
import { generateLoadingSheetPDF } from '@/lib/services/print/loading-sheet.service'
import { loadBatchLoadingSheetData } from '../../get-outbound-print-buffer'

export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error
    const permResult = await checkPermission(outboundShipmentConfig.permissions.list)
    if (permResult.error) return permResult.error

    const idsParam = request.nextUrl.searchParams.get('ids')
    if (!idsParam?.trim()) {
      return NextResponse.json({ error: '请提供 ids 参数，如 ids=1,2,3' }, { status: 400 })
    }
    const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean)
    if (ids.length === 0) {
      return NextResponse.json({ error: 'ids 不能为空' }, { status: 400 })
    }

    const [logoDataUrl, dataList] = await Promise.all([
      resolveLogoDataUrl(),
      loadBatchLoadingSheetData(ids),
    ])
    const withLogo = dataList
      .filter((d): d is NonNullable<typeof d> => d != null)
      .map((d) => ({ ...d, logoDataUrl: logoDataUrl ?? undefined }))
    const buffers = await Promise.all(
      withLogo.map((d) =>
        generateLoadingSheetPDF(d).then((b) => (Buffer.isBuffer(b) ? b : Buffer.from(b as ArrayBuffer)))
      )
    )
    if (buffers.length === 0) {
      return NextResponse.json(
        { error: '没有可用的出库预约数据可生成装车单' },
        { status: 404 }
      )
    }

    const merged = await mergePdfBuffers(buffers)
    const filename = `批量-装车单-${ids.length}份.pdf`
    return new NextResponse(merged as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
      },
    })
  } catch (error: any) {
    console.error('[Batch Loading Sheet]', error)
    return NextResponse.json(
      { error: error?.message || '批量生成装车单失败' },
      { status: 500 }
    )
  }
}
