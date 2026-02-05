/**
 * 装车单 PDF 生成服务（与 Excel 装车单模板一致）
 */

import { renderToBuffer } from '@react-pdf/renderer'
import { LoadingSheetDocument } from './loading-sheet-pdf'
import type { OAKLoadSheetData } from './types'

export async function generateLoadingSheetPDF(data: OAKLoadSheetData): Promise<Buffer> {
  const pdfDoc = <LoadingSheetDocument data={data} />
  const pdfBuffer = await renderToBuffer(pdfDoc)
  return pdfBuffer as Buffer
}
