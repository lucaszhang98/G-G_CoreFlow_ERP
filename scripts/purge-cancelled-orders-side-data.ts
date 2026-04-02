/**
 * 一次性：为所有 status = cancelled 的订单执行下游业务表清理（与订单更新为已取消时逻辑一致）。
 * 用法：npx tsx scripts/purge-cancelled-orders-side-data.ts
 */
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import prisma from '../lib/prisma'
import { ORDER_STATUS_CANCELLED } from '../lib/orders/order-visibility'
import { purgeOperationalDataForCancelledOrder } from '../lib/orders/cancelled-order-cleanup'

async function main() {
  const cancelled = await prisma.orders.findMany({
    where: { status: ORDER_STATUS_CANCELLED },
    select: { order_id: true, order_number: true },
  })
  console.log(`找到已取消订单 ${cancelled.length} 条，开始清理下游表…`)
  for (const row of cancelled) {
    await prisma.$transaction(async (tx) => {
      await purgeOperationalDataForCancelledOrder(tx, row.order_id)
    })
    console.log(`  已清理 order_id=${row.order_id} (${row.order_number})`)
  }
  console.log('完成。')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
