import * as XLSX from 'xlsx'
import { IMPORT_EDITABLE_SHEET } from '@/lib/mail-assistant/import-draft-matrix'

function isDetailDataRow(row: unknown[]): boolean {
  const orderNo = String(row[0] ?? '').trim()
  const detailLoc = String(row[20] ?? '').trim()
  const qty = String(row[22] ?? '').trim()
  return Boolean(orderNo || detailLoc || qty)
}

/** 将多份导入预报 Excel 合并为一份订单导入文件（仅数据行，保留首份表头） */
export function mergeImportDraftExcelBuffers(buffers: Buffer[]): Buffer {
  if (buffers.length === 0) {
    throw new Error('没有可合并的导入预报')
  }

  let header: unknown[] | null = null
  const dataRows: unknown[][] = []

  for (const buf of buffers) {
    const wb = XLSX.read(buf, { type: 'buffer', cellDates: true })
    const sheet = wb.Sheets[IMPORT_EDITABLE_SHEET] ?? wb.Sheets[wb.SheetNames[0]]
    if (!sheet) continue

    const matrix = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
    }) as unknown[][]

    if (matrix.length === 0) continue
    if (!header) header = matrix[0]

    for (let i = 1; i < matrix.length; i++) {
      const row = matrix[i] ?? []
      if (isDetailDataRow(row)) dataRows.push(row)
    }
  }

  if (!header || dataRows.length === 0) {
    throw new Error('导入预报中没有有效明细行')
  }

  const outWb = XLSX.utils.book_new()
  const outSheet = XLSX.utils.aoa_to_sheet([header, ...dataRows])
  XLSX.utils.book_append_sheet(outWb, outSheet, IMPORT_EDITABLE_SHEET)
  return Buffer.from(XLSX.write(outWb, { type: 'buffer', bookType: 'xlsx' }))
}
