/**
 * Excel 柜号 vs 2026-06-03 入库单：是否在表内、导入后 status、pickup 是否被更新
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as XLSX from 'xlsx'

dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const XLSX_PATH =
  process.argv[2] ||
  '/Users/lucaszhang/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_0n08k858f0pd21_84af/msg/file/2026-06/提柜管理批量导入模板_2026-05-25.xlsx'

const SURVIVORS = new Set(['EGSU6231214', 'FFAU7079247', 'EGHU8412012', 'TEMU7152607'])

async function main() {
  const { readFileSync } = await import('fs')
  const wb = XLSX.read(readFileSync(XLSX_PATH), { type: 'buffer' })
  const sheet = wb.Sheets['提柜数据1'] || wb.Sheets[wb.SheetNames[0]]
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet)
  const excelContainers = new Set(
    rows.map((r) => String(r['柜号'] ?? '').trim()).filter(Boolean)
  )

  const prisma = (await import('../lib/prisma')).default
  const dayStart = new Date('2026-06-03T00:00:00.000Z')
  const dayEnd = new Date('2026-06-04T00:00:00.000Z')

  const inbound = await prisma.inbound_receipt.findMany({
    where: {
      planned_unload_at: { gte: dayStart, lt: dayEnd },
      orders: { operation_mode: 'unload' },
    },
    select: {
      status: true,
      updated_at: true,
      orders: {
        select: {
          order_number: true,
          pickup_date: true,
          pickup_management: {
            select: { current_location: true, updated_at: true },
          },
        },
      },
    },
  })

  const importCutoff = new Date('2026-06-03T02:40:00.000Z')

  let inExcelPrinted = 0
  let inExcelPending = 0
  let notInExcelPrinted = 0
  let notInExcelPending = 0
  const details: object[] = []

  for (const r of inbound) {
    const cn = r.orders.order_number
    const inExcel = excelContainers.has(cn)
    const pm = r.orders.pickup_management
    const pickupTouchedAfterImport =
      pm?.updated_at != null && pm.updated_at >= importCutoff

    if (inExcel && r.status === 'printed') inExcelPrinted++
    if (inExcel && r.status === 'pending') inExcelPending++
    if (!inExcel && r.status === 'printed') notInExcelPrinted++
    if (!inExcel && r.status === 'pending') notInExcelPending++

    if (SURVIVORS.has(cn) || (inExcel && r.status === 'printed')) {
      details.push({
        cn,
        inExcel,
        status: r.status,
        pickupTouchedAfterImport,
        pickup_updated_at: pm?.updated_at,
        inbound_updated_at: r.updated_at,
      })
    }
  }

  console.log('Excel 柜号数:', excelContainers.size)
  console.log('2026-06-03 入库单数:', inbound.length)
  console.log({
    inExcel_and_printed: inExcelPrinted,
    inExcel_and_pending: inExcelPending,
    notInExcel_and_printed: notInExcelPrinted,
    notInExcel_and_pending: notInExcelPending,
  })
  console.log('\n幸存者 / Excel内仍已打印:')
  console.table(details)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
