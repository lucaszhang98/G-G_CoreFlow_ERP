/**
 * 客户发票 PDF 生成入口
 * Logo 与出库 BOL/装车单相同：resolveLogoDataUrl()（public/loading-sheet/logo.*）
 */

import { renderToBuffer } from '@react-pdf/renderer'
import { InvoicePdfDocument } from './invoice-pdf'
import { ensurePdfFont } from './register-pdf-font'
import { resolveLogoDataUrl } from './resolve-logo'
import { buildInvoicePdfPayload } from './invoice-pdf-data'

export async function generateCustomerInvoicePdf(
  invoiceId: bigint
): Promise<{ buffer: Buffer; invoiceNumber: string } | null> {
  ensurePdfFont()
  const logoDataUrl = await resolveLogoDataUrl()
  const payload = await buildInvoicePdfPayload(invoiceId, logoDataUrl)
  if (!payload) return null
  const pdfDoc = <InvoicePdfDocument data={payload} />
  const buf = await renderToBuffer(pdfDoc)
  const buffer = Buffer.isBuffer(buf) ? buf : Buffer.from(buf as ArrayBuffer)
  return { buffer, invoiceNumber: payload.invoiceNumber }
}
