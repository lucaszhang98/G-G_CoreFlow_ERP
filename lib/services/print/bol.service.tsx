/**
 * BOL (Bill of Lading) PDF 生成服务
 * 与 docs/135928027988 SCK8 BOL.pdf 样本一致
 */

import { renderToBuffer } from '@react-pdf/renderer'
import { BOLDocument } from './bol-pdf'
import { ensurePdfFont } from './register-pdf-font'
import type { OAKBOLData } from './types'

export async function generateBOLPDF(data: OAKBOLData): Promise<Buffer> {
  ensurePdfFont()
  const pdfDoc = <BOLDocument data={data} />
  const pdfBuffer = await renderToBuffer(pdfDoc)
  return pdfBuffer as Buffer
}
