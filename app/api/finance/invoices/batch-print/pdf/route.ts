/**
 * GET /api/finance/invoices/batch-print/pdf?ids=1,2,3
 * 批量合并客户发票 INVOICE PDF（与出库批量 BOL 相同：GET + ids + inline 在浏览器打开）
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/api/helpers'
import { invoiceConfig } from '@/lib/crud/configs/invoices'
import { generateCustomerInvoicePdf } from '@/lib/services/print/invoice-pdf.service'
import { mergePdfBuffers } from '@/lib/services/print/merge-pdf'

const MAX_IDS = 40

export async function GET(request: NextRequest) {
  try {
    const perm = await checkPermission(invoiceConfig.permissions.list)
    if (perm.error) return perm.error

    const noLogo =
      request.nextUrl.searchParams.get('noLogo') === '1' ||
      request.nextUrl.searchParams.get('noLogo') === 'true'

    const idsParam = request.nextUrl.searchParams.get('ids')
    if (!idsParam?.trim()) {
      return NextResponse.json({ error: '请提供 ids 参数，如 ids=1,2,3' }, { status: 400 })
    }

    const raw = idsParam.split(',').map((s) => s.trim()).filter(Boolean)
    const numeric = raw.filter((id) => /^\d+$/.test(id))
    const uniqueIds = [...new Set(numeric)]
    if (uniqueIds.length === 0) {
      return NextResponse.json({ error: 'ids 中无有效的发票 ID' }, { status: 400 })
    }
    if (uniqueIds.length > MAX_IDS) {
      return NextResponse.json({ error: `单次最多合并 ${MAX_IDS} 张发票` }, { status: 400 })
    }

    const results = await Promise.all(
      uniqueIds.map((id) =>
        generateCustomerInvoicePdf(BigInt(id), { includeLogo: !noLogo })
      )
    )

    const failed = uniqueIds.filter((id, i) => !results[i])
    if (failed.length > 0) {
      return NextResponse.json(
        { error: `部分发票不存在或生成失败：${failed.join(', ')}` },
        { status: 404 }
      )
    }

    const buffers = results.map((r) => r!.buffer)
    const merged =
      buffers.length === 1 ? buffers[0] : await mergePdfBuffers(buffers)

    const filename = `批量-发票单据-${uniqueIds.length}份.pdf`

    return new NextResponse(merged as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
      },
    })
  } catch (e: unknown) {
    console.error('[batch invoice pdf]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '合并 PDF 失败' },
      { status: 500 }
    )
  }
}
