import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

async function main() {
  const prisma = (await import('../lib/prisma')).default
  const dayStart = new Date('2026-06-03T00:00:00.000Z')
  const dayEnd = new Date('2026-06-04T00:00:00.000Z')

  const rows = await prisma.inbound_receipt.findMany({
    where: {
      planned_unload_at: { gte: dayStart, lt: dayEnd },
      orders: { operation_mode: 'unload' },
    },
    select: {
      inbound_receipt_id: true,
      status: true,
      orders: {
        select: { order_number: true, order_id: true, status: true },
      },
    },
  })

  const byCn = new Map<string, typeof rows>()
  for (const r of rows) {
    const cn = r.orders.order_number
    if (!byCn.has(cn)) byCn.set(cn, [])
    byCn.get(cn)!.push(r)
  }

  let dupGroups = 0
  for (const [cn, list] of byCn) {
    if (list.length < 2) continue
    dupGroups++
    console.log('\n重复柜号', cn)
    for (const r of list) {
      console.log(' ', {
        inbound_id: r.inbound_receipt_id.toString(),
        order_id: r.orders.order_id.toString(),
        order_status: r.orders.status,
        inbound_status: r.status,
      })
    }
  }
  console.log('\n2026-06-03 入库单', rows.length, '组重复柜号', dupGroups)
  await prisma.$disconnect()
}

main()
