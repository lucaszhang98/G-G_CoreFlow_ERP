/**
 * 仅对已存在的拆柜账单（invoice_type = unload 且已挂 order_id）按当前逻辑重算明细与合计。
 *
 * - 调用 `syncContainerUnloadInvoiceForOrder`：已有账单时 **不会** 新建、**不会** 改 `invoice_number`，
 *   只删除该账下旧 `invoice_line_items` 后按规则重建并重算总额。
 * - 同一订单若有多张 unload 账单（异常数据），按 `invoice_id` 去重后每个 `order_id` 只同步一次（与线上一致 findFirst 行为）。
 *
 * 用法：
 *   pnpm exec tsx scripts/resync-existing-container-unload-invoices.ts
 *   pnpm exec tsx scripts/resync-existing-container-unload-invoices.ts --dry-run
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'
import prisma from '../lib/prisma'
import { syncContainerUnloadInvoiceForOrder } from '../lib/finance/container-unload-sync'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const dryRun = process.argv.includes('--dry-run')

async function main() {
  const rows = await prisma.invoices.findMany({
    where: {
      invoice_type: 'unload',
      order_id: { not: null },
    },
    select: {
      invoice_id: true,
      order_id: true,
      invoice_number: true,
    },
    orderBy: { invoice_id: 'asc' },
  })

  const byOrder = new Map<string, { invoice_id: bigint; invoice_number: string }>()
  for (const r of rows) {
    if (!r.order_id) continue
    const key = r.order_id.toString()
    if (!byOrder.has(key)) {
      byOrder.set(key, { invoice_id: r.invoice_id, invoice_number: r.invoice_number })
    }
  }

  const jobs = Array.from(byOrder.entries()).map(([orderIdStr, inv]) => ({
    order_id: BigInt(orderIdStr),
    invoice_id: inv.invoice_id,
    invoice_number: inv.invoice_number,
  }))

  console.log(
    `unload 账单行数（含重复 order）: ${rows.length}；去重后待同步订单数: ${jobs.length}`
  )

  if (dryRun) {
    jobs.slice(0, 30).forEach((j) => {
      console.log(
        `  [dry-run] order_id=${j.order_id} invoice_number=${j.invoice_number} invoice_id=${j.invoice_id}`
      )
    })
    if (jobs.length > 30) console.log(`  ... 共 ${jobs.length} 条`)
    console.log('\n去掉 --dry-run 后执行重算。')
    await prisma.$disconnect()
    return
  }

  let ok = 0
  let fail = 0
  for (const j of jobs) {
    const r = await syncContainerUnloadInvoiceForOrder(j.order_id, null)
    if (r.ok) {
      ok++
      console.log(`OK order_id=${j.order_id} invoice_number=${j.invoice_number}`)
    } else {
      fail++
      console.error(`FAIL order_id=${j.order_id} invoice_number=${j.invoice_number}: ${r.error}`)
    }
  }

  console.log(`\n完成: 成功 ${ok}, 失败 ${fail}`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
