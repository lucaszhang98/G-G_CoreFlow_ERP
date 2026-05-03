/**
 * 一次性：为所有「入库状态 = 已入库 + 订单含扣货明细」的订单补建/重算仓储账单（与线上 syncStorageInvoiceForOrder 一致）。
 *
 * 用法：
 *   pnpm exec tsx scripts/backfill-storage-invoices.ts
 *   pnpm exec tsx scripts/backfill-storage-invoices.ts --dry-run
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'
import prisma from '../lib/prisma'
import {
  backfillAllStorageInvoicesForReceivedDetentionOrders,
  STORAGE_DETENTION_DELIVERY_NATURE,
} from '../lib/finance/storage-invoice-sync'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const dryRun = process.argv.includes('--dry-run')

async function main() {
  const receivedCount = await prisma.inbound_receipt.count({
    where: { status: 'received' },
  })
  const detentionDetailCount = await prisma.order_detail.count({
    where: { delivery_nature: STORAGE_DETENTION_DELIVERY_NATURE },
  })

  const eligible = await prisma.inbound_receipt.findMany({
    where: {
      status: 'received',
      orders: {
        order_detail: {
          some: { delivery_nature: STORAGE_DETENTION_DELIVERY_NATURE },
        },
      },
    },
    select: { order_id: true },
  })
  const uniqueOrders = new Set(eligible.map((r) => r.order_id.toString())).size

  console.log(
    `诊断: 入库「已入库」条数=${receivedCount}; 含「${STORAGE_DETENTION_DELIVERY_NATURE}」的仓点明细行数=${detentionDetailCount}; 同时满足的订单数≈${uniqueOrders}`
  )

  if (dryRun) {
    console.log('\n[--dry-run] 不写入数据库。去掉 --dry-run 后执行补全。')
    await prisma.$disconnect()
    return
  }

  const result = await backfillAllStorageInvoicesForReceivedDetentionOrders(null)
  console.log('\n补全结果:', JSON.stringify(result, null, 2))
  if (result.orderCount === 0) {
    console.log(
      '\n提示: 无待补订单。请确认：1) 入库管理该柜状态为「已入库」；2) 订单明细存在性质为「扣货」的行；3) 若刚改数据，可先保存入库/明细后再跑本脚本。'
    )
  }
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
