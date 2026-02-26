/**
 * Label 第二行与条形码统一规则（与装车单、入库打印 Label 完全一致）
 *
 * - 私仓：第二行 = 备注（可为空）
 * - 转仓：第二行 = 仓点 + '+'
 * - 亚马逊/其他：第二行 = 仓点
 * - 扣货：第二行 = 仓点 + '-hold'
 *
 * 条形码 = 第一行(柜号) + 第二行，去除所有空格。
 */
export function getLabelSecondRowAndBarcode(
  containerNumber: string,
  deliveryLocation: string,
  deliveryNature?: string | null,
  notes?: string | null
): { secondRow: string; barcode: string } {
  let secondRow = ''
  if (deliveryNature === '私仓') {
    secondRow = notes ?? ''
  } else if (deliveryNature === '转仓') {
    secondRow = (deliveryLocation || '') + '+'
  } else {
    secondRow = deliveryLocation || ''
    if (deliveryNature === '扣货') secondRow += '-hold'
  }
  const barcode = `${containerNumber || ''}${secondRow}`.replace(/\s+/g, '')
  return { secondRow, barcode }
}
