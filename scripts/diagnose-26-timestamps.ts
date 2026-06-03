import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

async function main() {
  const prisma = (await import('../lib/prisma')).default
  const { ordersWhereOperational } = await import('../lib/orders/operational-order-lookup')

  const rows = await prisma.inbound_receipt.findMany({
    where: {
      planned_unload_at: {
        gte: new Date('2026-06-03T00:00:00.000Z'),
        lt: new Date('2026-06-04T00:00:00.000Z'),
      },
      orders: { operation_mode: 'unload', ...ordersWhereOperational() },
    },
    select: {
      status: true,
      updated_at: true,
      orders: {
        select: {
          order_number: true,
          pickup_management: { select: { updated_at: true } },
        },
      },
    },
    orderBy: { updated_at: 'asc' },
  })

  const batchWindow = new Date('2026-06-03T02:51:00.000Z')
  const batchEnd = new Date('2026-06-03T02:51:59.999Z')
  const importStart = new Date('2026-06-03T02:52:00.000Z')

  let batchPrinted = 0
  let importUpdated = 0
  for (const r of rows) {
    const t = r.updated_at
    const cn = r.orders.order_number
    const inBatch = t >= batchWindow && t <= batchEnd
    const inImport = t >= importStart
    if (inBatch && r.status === 'printed') batchPrinted++
    if (inImport) importUpdated++
    console.log({
      cn,
      status: r.status,
      inbound_updated: t.toISOString(),
      pickup_updated: r.orders.pickup_management?.updated_at?.toISOString(),
      inBatchWindow: inBatch,
      inImportWindow: inImport,
    })
  }
  console.log('\n汇总', {
    total: rows.length,
    printedInBatchWindow: batchPrinted,
    updatedDuringImport: importUpdated,
  })
  await prisma.$disconnect()
}

main()
