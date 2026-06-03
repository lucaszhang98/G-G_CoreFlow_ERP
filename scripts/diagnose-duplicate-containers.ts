/**
 * 查重复柜号订单与入库单
 */
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const CONTAINERS = ['EGHU8412012', 'FFAU7079247', 'TEMU7152607', 'EGSU6231214']

async function main() {
  const prisma = (await import('../lib/prisma')).default

  for (const cn of CONTAINERS) {
    const orders = await prisma.orders.findMany({
      where: { order_number: cn },
      select: {
        order_id: true,
        order_number: true,
        operation_mode: true,
        status: true,
        inbound_receipt: {
          select: {
            inbound_receipt_id: true,
            status: true,
            planned_unload_at: true,
            updated_at: true,
          },
        },
        pickup_management: {
          select: { pickup_id: true, updated_at: true, current_location: true },
        },
      },
    })
    console.log('\n===', cn, '订单数:', orders.length, '===')
    for (const o of orders) {
      console.log({
        order_id: o.order_id.toString(),
        operation_mode: o.operation_mode,
        order_status: o.status,
        inbound_id: o.inbound_receipt?.inbound_receipt_id?.toString(),
        inbound_status: o.inbound_receipt?.status,
        planned_unload_at: o.inbound_receipt?.planned_unload_at,
        inbound_updated_at: o.inbound_receipt?.updated_at,
        pickup_updated_at: o.pickup_management?.updated_at,
      })
    }
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
