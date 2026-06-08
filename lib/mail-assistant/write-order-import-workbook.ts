import ExcelJS from 'exceljs'
import { generateOrderImportTemplate } from '@/lib/utils/excel-template'
import type { OrderImportDraftOutputRow } from '@/lib/mail-assistant/transform-source-to-import-rows'
import type { OrderImportMasterData } from '@/lib/mail-assistant/order-import-master-data'

const TEMPLATE_ROW_COUNT = 200

/** 使用原版订单批量导入模板，去掉示例行后填入数据 */
export async function writeOrderImportWorkbook(
  rows: OrderImportDraftOutputRow[],
  master: OrderImportMasterData
): Promise<ExcelJS.Workbook> {
  const workbook = await generateOrderImportTemplate({
    customers: master.customers,
    locations: master.locations,
  })

  const sheet = workbook.getWorksheet('订单导入模板')
  if (!sheet) throw new Error('找不到「订单导入模板」工作表')

  // 清除示例行与预填充空行（第 2 行起）
  for (let r = 2; r <= TEMPLATE_ROW_COUNT + 1; r++) {
    const row = sheet.getRow(r)
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.value = null
    })
  }

  let rowIndex = 2
  for (const data of rows) {
    const row = sheet.getRow(rowIndex)

    row.getCell(1).value = data.order_number
    row.getCell(2).value = data.customer_code

    const orderDateCell = row.getCell(3)
    orderDateCell.value = data.order_date_serial
    orderDateCell.numFmt = 'yyyy-mm-dd'

    row.getCell(4).value = data.operation_mode
    row.getCell(5).value = data.delivery_location_code
    row.getCell(6).value = data.container_type

    const etaCell = row.getCell(7)
    etaCell.value = data.eta_serial
    etaCell.numFmt = 'yyyy-mm-dd'

    row.getCell(8).value = data.mbl_number
    row.getCell(9).value = data.do_issued

    row.getCell(21).value = data.detail_delivery_location_code
    row.getCell(22).value = data.delivery_nature
    row.getCell(23).value = data.quantity
    row.getCell(24).value = data.volume
    row.getCell(25).value = data.fba || null
    row.getCell(26).value = data.po || null
    row.getCell(27).value = data.detail_notes || null
    row.getCell(28).value = data.window_period || null

    row.commit()
    rowIndex++
  }

  return workbook
}

export async function workbookToBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  const buf = await workbook.xlsx.writeBuffer()
  return Buffer.from(buf)
}
