/**
 * 只读：拆柜日 2026-06-03 的入库单在「库内 status」与「展示逻辑」下的分布
 * npx tsx scripts/diagnose-import-rollback-june3.ts
 */
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

async function main() {
  const prisma = (await import('../lib/prisma')).default
  const {
    isExitingInspectionArea,
    resolveInboundDisplayStatus,
  } = await import('../lib/wms/current-location-blocks-unload')

  const start = new Date('2026-06-03T00:00:00.000Z')
  const end = new Date('2026-06-04T00:00:00.000Z')

  const rows = await prisma.inbound_receipt.findMany({
    where: {
      planned_unload_at: { gte: start, lt: end },
      orders: { operation_mode: 'unload' },
    },
    select: {
      status: true,
      orders: {
        select: {
          order_number: true,
          pickup_management: { select: { current_location: true } },
        },
      },
    },
  })

  const storedCounts: Record<string, number> = {}
  let wouldExitOnEmptyExcel = 0
  let displayPendingButStoredPrinted = 0

  for (const r of rows) {
    storedCounts[r.status] = (storedCounts[r.status] ?? 0) + 1
    const prev = r.orders.pickup_management?.current_location ?? null
    const newLoc = null
    if (isExitingInspectionArea(prev, newLoc, r.status)) wouldExitOnEmptyExcel++
    const display = resolveInboundDisplayStatus(newLoc, r.status)
    if (r.status === 'printed' && display === 'pending') displayPendingButStoredPrinted++
  }

  console.log({ total: rows.length, storedCounts })
  console.log({
    wouldExitOnEmptyExcelImport: wouldExitOnEmptyExcel,
    storedPrintedButDisplayPending: displayPendingButStoredPrinted,
  })

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
