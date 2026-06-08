import { downloadGmailAttachment } from '@/lib/google/gmail-forecast'
import { loadOrderImportMasterData } from '@/lib/mail-assistant/order-import-master-data'
import { parseSourceForecastExcel } from '@/lib/mail-assistant/parse-source-forecast-excel'
import { transformSourceToImportRows } from '@/lib/mail-assistant/transform-source-to-import-rows'
import {
  workbookToBuffer,
  writeOrderImportWorkbook,
} from '@/lib/mail-assistant/write-order-import-workbook'
import { normalizeContainerNumber } from '@/lib/mail-assistant/forecast-template-profile'

/** 订单批量导入模板可见列（与 order-import headerMap 一致） */
export const ORDER_IMPORT_HEADERS = [
  '订单号',
  '客户代码',
  '订单日期',
  '操作方式',
  '目的地',
  '货柜类型',
  'ETA',
  'MBL',
  'DO',
  '送仓地点',
  '性质',
  '数量',
  '体积',
] as const

export type OrderImportDraftRow = Record<(typeof ORDER_IMPORT_HEADERS)[number], string>

export async function generateOrderImportDraftFromSource(input: {
  containerNumber: string
  messageId: string
  attachmentId: string
  filename: string
}): Promise<{ buffer: Buffer; row: OrderImportDraftRow; warnings: string[] }> {
  const container = normalizeContainerNumber(input.containerNumber)
  const sourceBuffer = await downloadGmailAttachment(input.messageId, input.attachmentId)

  const [master, parsed] = await Promise.all([
    loadOrderImportMasterData(),
    Promise.resolve(parseSourceForecastExcel(sourceBuffer, container)),
  ])

  const { rows, warnings } = transformSourceToImportRows(parsed, container, master)

  if (rows.length === 0) {
    throw new Error(
      warnings.length
        ? `无法生成导入预报：${warnings.join('；')}`
        : '无法从源预报解析明细行'
    )
  }

  const workbook = await writeOrderImportWorkbook(rows, master)
  const buffer = await workbookToBuffer(workbook)

  const first = rows[0]
  const legacyRow: OrderImportDraftRow = {
    订单号: first.order_number,
    客户代码: first.customer_code,
    订单日期: serialToIso(first.order_date_serial),
    操作方式: first.operation_mode,
    目的地: first.delivery_location_code,
    货柜类型: first.container_type,
    ETA: serialToIso(first.eta_serial),
    MBL: first.mbl_number,
    DO: first.do_issued,
    送仓地点: first.detail_delivery_location_code,
    性质: first.delivery_nature,
    数量: String(first.quantity),
    体积: String(first.volume),
  }

  if (rows.length > 1) {
    warnings.push(`已按送仓地点+性质汇总为 ${rows.length} 行导入明细`)
  }

  return { buffer, row: legacyRow, warnings }
}

function serialToIso(serial: number): string {
  const excelEpoch = new Date(1899, 11, 30)
  const d = new Date(excelEpoch.getTime() + serial * 86400000)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function buildImportDraftDownloadPath(
  messageId: string,
  attachmentId: string,
  containerNumber: string,
  filename?: string
): string {
  const params = new URLSearchParams({
    messageId,
    attachmentId,
    containerNumber,
  })
  if (filename) params.set('sourceFilename', filename)
  return `/api/google/workspace/forecast-import-draft?${params.toString()}`
}
