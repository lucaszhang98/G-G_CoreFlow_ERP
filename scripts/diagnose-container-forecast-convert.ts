/**
 * npx tsx scripts/diagnose-container-forecast-convert.ts DRYU9853033
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'
import * as XLSX from 'xlsx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

import prisma from '../lib/prisma'
import { downloadGmailAttachment } from '../lib/google/gmail-forecast'
import {
  parseSourceForecastExcel,
  isSourceForecastTemplateInputFormat,
} from '../lib/mail-assistant/parse-source-forecast-excel'
import {
  isDedicatedDetail,
  loadOrderImportMasterData,
  matchDeliveryNature,
} from '../lib/mail-assistant/order-import-master-data'
import { transformSourceToImportRows } from '../lib/mail-assistant/transform-source-to-import-rows'

const cn = (process.argv[2] ?? '').trim().toUpperCase()
if (!cn) {
  console.error('Usage: npx tsx scripts/diagnose-container-forecast-convert.ts <CONTAINER>')
  process.exit(1)
}

async function main() {
  const row = await prisma.mail_container_forecast.findUnique({
    where: { container_number: cn },
  })
  if (!row?.message_id || !row.attachment_id) {
    console.error('No forecast row or attachment')
    process.exit(1)
  }

  const buf = await downloadGmailAttachment(row.message_id, row.attachment_id)
  const parsed = parseSourceForecastExcel(buf, cn)
  const dedicated = parsed.details.filter((d) => isDedicatedDetail(d))

  console.log('=== Parse ===')
  console.log({
    filename: row.source_filename,
    format: parsed.format,
    isTemplate: isSourceForecastTemplateInputFormat(parsed),
    detailCount: parsed.details.length,
    dedicatedCount: dedicated.length,
  })

  console.log('\n=== Raw rows mentioning 自提/私仓/pickup ===')
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: false })
  const sheetRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    header: 1,
    defval: '',
  }) as unknown[][]
  let shown = 0
  for (let i = 0; i < sheetRows.length; i++) {
    const text = JSON.stringify(sheetRows[i]).toLowerCase()
    if (
      text.includes('自提') ||
      text.includes('私仓') ||
      text.includes('pickup') ||
      text.includes('private') ||
      text.includes('fedex')
    ) {
      console.log(`row ${i + 1}:`, sheetRows[i])
      shown++
      if (shown >= 30) break
    }
  }

  console.log('\n=== Dedicated parsed details (first 15) ===')
  for (const d of dedicated.slice(0, 15)) {
    console.log({
      loc: d.deliveryLocationRaw,
      mark: d.shippingMarkRaw,
      nature: d.deliveryNatureRaw,
      qty: d.quantity,
    })
  }

  console.log('\n=== Parsed but NOT dedicated (possible mis-route) ===')
  for (const d of parsed.details.filter((x) => !isDedicatedDetail(x))) {
    const nature = matchDeliveryNature(d.deliveryNatureRaw)
    const loc = d.deliveryLocationRaw.trim()
    const looksPrivate =
      !/^[A-Z0-9]{3,5}$/i.test(loc) &&
      loc.length > 0 &&
      nature === 'AMZ'
    if (looksPrivate || d.deliveryNatureRaw.includes('自提') || d.deliveryNatureRaw.includes('私')) {
      console.log({
        loc: d.deliveryLocationRaw,
        mark: d.shippingMarkRaw,
        nature: d.deliveryNatureRaw,
        matchedNature: nature,
      })
    }
  }

  console.log('\n=== Header row (index 9) ===')
  const header = sheetRows[9] ?? []
  header.forEach((cell, idx) => console.log(`  col ${idx}: ${JSON.stringify(cell)}`))
  console.log('AMZ sample row 11:', sheetRows[10])
  console.log('Pickup sample row 42:', sheetRows[41])

  console.log('\n=== Parsed rows with 自提 nature or XH260530 mark ===')
  for (const d of parsed.details) {
    if (
      d.deliveryNatureRaw.includes('自提') ||
      d.deliveryLocationRaw.includes('XH260530') ||
      d.shippingMarkRaw.includes('DJY')
    ) {
      console.log(d, 'dedicated?', isDedicatedDetail(d))
    }
  }

  const master = await loadOrderImportMasterData()
  const { rows, warnings } = transformSourceToImportRows(parsed, cn, master)
  console.log('\n=== Transform output ===')
  console.log({
    rowCount: rows.length,
    pickupPrivate: rows.filter((r) => /pickup|private|fedex/i.test(r.detail_delivery_location_code))
      .length,
    amz: rows.filter((r) => r.delivery_nature === 'AMZ').length,
  })
  console.log('warnings:', warnings.join('; '))

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
