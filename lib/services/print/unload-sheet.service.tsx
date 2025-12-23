/**
 * 拆柜单据生成服务
 * 
 * 功能：
 * 1. 根据入库管理数据生成拆柜单据数据
 * 2. 生成 PDF（A4 竖排）
 */

import { UnloadSheetData } from './types'
import { renderToBuffer } from '@react-pdf/renderer'
import { UnloadSheetDocument } from './unload-sheet-pdf'

/**
 * 生成拆柜单据 PDF
 * 
 * @param data 拆柜单据数据
 * @returns PDF Buffer
 */
export async function generateUnloadSheetPDF(data: UnloadSheetData): Promise<Buffer> {
  if (!data || !data.containerNumber) {
    throw new Error('拆柜单据数据不完整：缺少柜号')
  }

  if (!data.orderDetails || data.orderDetails.length === 0) {
    throw new Error('拆柜单据数据不完整：缺少明细行')
  }

  // 使用 @react-pdf/renderer 生成 PDF
  const pdfDoc = <UnloadSheetDocument data={data} />
  
  // 渲染为 Buffer
  const pdfBuffer = await renderToBuffer(pdfDoc)
  
  return pdfBuffer
}
