/**
 * 客户发票 INVOICE PDF（一单一份），浏览器 inline 打开，与 BOL 打印一致
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/api/helpers'
import { invoiceConfig } from '@/lib/crud/configs/invoices'
import { generateCustomerInvoicePdf } from '@/lib/services/print/invoice-pdf.service'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const perm = await checkPermission(invoiceConfig.permissions.list)
    if (perm.error) return perm.error

    const { id } = await context.params
    if (!id || !/^\d+$/.test(id)) {
      return NextResponse.json({ error: '无效的发票 ID' }, { status: 400 })
    }

    const invoiceId = BigInt(id)
    const noLogo =
      _request.nextUrl.searchParams.get('noLogo') === '1' ||
      _request.nextUrl.searchParams.get('noLogo') === 'true'
    const result = await generateCustomerInvoicePdf(invoiceId, {
      includeLogo: !noLogo,
    })
    if (!result || result.buffer.length < 100) {
      return NextResponse.json({ error: '发票不存在或生成失败' }, { status: 404 })
    }

    const safeName = result.invoiceNumber.replace(/[/\\?%*:|"<>]/g, '-')
    const filename = `${safeName}.pdf`

    return new NextResponse(result.buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
      },
    })
  } catch (e: unknown) {
    console.error('[invoice print pdf]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '生成 PDF 失败' },
      { status: 500 }
    )
  }
}
