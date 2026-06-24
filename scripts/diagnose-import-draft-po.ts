/**
 * 诊断邮件助手导入预报 PO 列：解析 → 转换 → 缓存文件
 * 用法: npx tsx scripts/diagnose-import-draft-po.ts EGHU9493615
 */
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import * as XLSX from 'xlsx'
import prisma from '../lib/prisma'
import { downloadGmailAttachment } from '../lib/google/gmail-forecast'
import { parseSourceForecastExcel } from '../lib/mail-assistant/parse-source-forecast-excel'
import { transformSourceToImportRows } from '../lib/mail-assistant/transform-source-to-import-rows'
import { loadOrderImportMasterData } from '../lib/mail-assistant/order-import-master-data'
import { extractImportDraftMatrix } from '../lib/mail-assistant/import-draft-matrix-io'
import { normalizeHeaderCell } from '../lib/mail-assistant/forecast-template-profile'

const cn = (process.argv[2] ?? 'EGHU9493615').trim().toUpperCase()

async function main() {
  const row = await prisma.mail_container_forecast.findUnique({
    where: { container_number: cn },
  })
  if (!row) {
    console.error('DB 无此柜号记录')
    process.exit(1)
  }

  console.log('=== DB ===')
  console.log({
    status: row.status,
    source_filename: row.source_filename,
    import_draft_updated_at: row.import_draft_updated_at,
    draft_bytes: row.import_draft_data?.length ?? 0,
    warnings: row.import_draft_warnings?.slice(0, 200),
  })

  if (row.import_draft_data?.length) {
    const matrix = extractImportDraftMatrix(Buffer.from(row.import_draft_data))
    const header = matrix[0] ?? []
    const poCol = header.findIndex((h) => normalizeHeaderCell(h) === 'po')
    console.log('\n=== 缓存导入预报 ===')
    console.log('PO 列 index:', poCol, 'header:', header[poCol])
    console.log('headers[20-28]:', header.slice(20, 29))
    for (let i = 1; i < Math.min(matrix.length, 8); i++) {
      const r = matrix[i] ?? []
      const hasData = r.some((c) => String(c ?? '').trim())
      if (!hasData) continue
      console.log(`  row${i} PO=${JSON.stringify(r[poCol])} FBA=${JSON.stringify(r[header.findIndex((h) => normalizeHeaderCell(h) === 'fba')])}`)
    }
  }

  if (!row.message_id || !row.attachment_id) {
    console.error('无 Gmail 附件，无法拉源预报')
    process.exit(1)
  }

  console.log('\n=== 源预报 Excel ===')
  const sourceBuffer = await downloadGmailAttachment(row.message_id, row.attachment_id)
  const wb = XLSX.read(sourceBuffer, { type: 'buffer', cellDates: false })

  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
      header: 1,
      defval: '',
    }) as unknown[][]

    console.log(`\nSheet: ${sheetName}`)
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const r = rows[i] ?? []
      const cells = r.slice(0, 14).map((c) => String(c ?? '').trim())
      if (cells.some(Boolean)) {
        console.log(`  r${i + 1}:`, cells.join(' | '))
      }
    }

    // 找含 PO 的表头行
    for (let i = 0; i < Math.min(rows.length, 40); i++) {
      const r = rows[i] ?? []
      const poIdx = r.findIndex((c) => normalizeHeaderCell(c) === 'po')
      if (poIdx >= 0) {
        console.log(`  表头行 r${i + 1} PO col=${poIdx}`, r.map((c) => String(c ?? '').trim()))
        const sample = rows.slice(i + 1, i + 4).map((row) => String((row as unknown[])?.[poIdx] ?? ''))
        console.log('  PO 样例值:', sample)
      }
    }
  }

  const parsed = parseSourceForecastExcel(sourceBuffer, cn)
  console.log('\n=== parseSourceForecastExcel ===')
  console.log('format:', parsed.format, 'details:', parsed.details.length)
  const withPo = parsed.details.filter((d) => d.po.trim())
  console.log('有 PO 的明细行:', withPo.length)
  console.log('PO 样例:', withPo.slice(0, 5).map((d) => d.po))

  const master = await loadOrderImportMasterData()
  const { rows: outRows, warnings } = transformSourceToImportRows(parsed, cn, master, {
    fixedOrderDateKey: row.yg_order_date_key,
  })
  console.log('\n=== transformSourceToImportRows ===')
  console.log('warnings:', warnings.slice(0, 5))
  console.log('out rows:', outRows.length)
  for (const r of outRows.slice(0, 6)) {
    console.log(`  ${r.detail_delivery_location_code} po=${JSON.stringify(r.po)} fba=${JSON.stringify(r.fba?.slice(0, 40))}`)
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
