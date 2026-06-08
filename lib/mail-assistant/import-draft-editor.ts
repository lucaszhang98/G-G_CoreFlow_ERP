import ExcelJS from 'exceljs'
import { workbookToBuffer } from '@/lib/mail-assistant/write-order-import-workbook'
import { IMPORT_EDITABLE_SHEET } from '@/lib/mail-assistant/import-draft-matrix'

export { IMPORT_EDITABLE_SHEET }

const DATE_COLS = new Set([3, 7])
const NUM_COLS = new Set([23, 24])

function parseImportCellValue(col1Based: number, raw: string): ExcelJS.CellValue {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return null

  if (DATE_COLS.has(col1Based)) {
    const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (iso) {
      return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
    }
    const serial = Number(trimmed)
    if (Number.isFinite(serial) && serial > 30000 && serial < 60000) return serial
  }

  if (NUM_COLS.has(col1Based)) {
    const n = Number(trimmed)
    if (Number.isFinite(n)) return n
  }

  return trimmed
}

/** 将前端编辑矩阵写回导入预报工作簿（保留模板结构与校验） */
export async function applyImportDraftMatrix(
  buffer: Buffer,
  rows: string[][]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  // ExcelJS 类型与 Node Buffer 泛型声明不完全兼容
  await workbook.xlsx.load(buffer as unknown as Parameters<ExcelJS.Workbook['xlsx']['load']>[0])
  const sheet = workbook.getWorksheet(IMPORT_EDITABLE_SHEET)
  if (!sheet) throw new Error('找不到「订单导入模板」工作表')

  for (let r = 2; r <= 201; r++) {
    const row = sheet.getRow(r)
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.value = null
    })
  }

  for (let i = 1; i < rows.length; i++) {
    const excelRow = i + 1
    const row = sheet.getRow(excelRow)
    const values = rows[i] ?? []
    for (let c = 0; c < values.length; c++) {
      const col1 = c + 1
      const cell = row.getCell(col1)
      const val = parseImportCellValue(col1, values[c])
      cell.value = val
      if (DATE_COLS.has(col1) && (val instanceof Date || typeof val === 'number')) {
        cell.numFmt = 'yyyy-mm-dd'
      }
    }
    row.commit()
  }

  return workbookToBuffer(workbook)
}
