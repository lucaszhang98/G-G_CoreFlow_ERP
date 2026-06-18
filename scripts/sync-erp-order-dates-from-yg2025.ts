/**
 * 将 ERP 在途订单的 order_date 对齐为 YG2025 码头表上的订单日期（邮件助手比对范围）。
 * 运行：npx tsx scripts/sync-erp-order-dates-from-yg2025.ts
 * 加 --dry-run 仅预览不写库
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
import prisma from '../lib/prisma'
import {
  fetchYg2025ImportCheck,
  normalizeContainerNumber,
  toOrderDateKey,
} from '../lib/google/oak-yg2025-sheet'
import { ordersWhereRootExcludeArchived } from '../lib/orders/order-visibility'
import { orderDateKeyToUtcDate } from '../lib/mail-assistant/yg2025-order-date'

dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const dryRun = process.argv.includes('--dry-run')

async function main() {
  const yg = await fetchYg2025ImportCheck()
  const erpOrders = await prisma.orders.findMany({
    where: ordersWhereRootExcludeArchived(),
    select: {
      order_id: true,
      order_number: true,
      order_date: true,
      status: true,
    },
  })

  const erpByContainer = new Map<string, typeof erpOrders>()
  for (const o of erpOrders) {
    const cn = normalizeContainerNumber(o.order_number ?? '')
    if (!cn) continue
    const list = erpByContainer.get(cn) ?? []
    list.push(o)
    erpByContainer.set(cn, list)
  }

  let updated = 0
  let skippedNoErp = 0
  let skippedSame = 0
  const ambiguous: string[] = []

  for (const row of yg.rows) {
    const cn = normalizeContainerNumber(row.containerNumber)
    const targetKey = row.orderDateKey
    const targetDate = orderDateKeyToUtcDate(targetKey)
    if (!targetDate) continue

    const candidates = erpByContainer.get(cn) ?? []
    if (candidates.length === 0) {
      skippedNoErp++
      continue
    }

    let pick = candidates[0]
    if (candidates.length > 1) {
      const targetUtc = targetDate.getTime()
      pick = [...candidates].sort(
        (a, b) =>
          Math.abs(a.order_date.getTime() - targetUtc) -
          Math.abs(b.order_date.getTime() - targetUtc)
      )[0]
      if (candidates.length > 1 && !ambiguous.includes(cn)) {
        ambiguous.push(cn)
      }
    }

    const currentKey = toOrderDateKey(pick.order_date)
    if (currentKey === targetKey) {
      skippedSame++
      continue
    }

    if (!dryRun) {
      await prisma.orders.update({
        where: { order_id: pick.order_id },
        data: { order_date: targetDate, updated_at: new Date() },
      })
    }
    updated++
    if (updated <= 15) {
      console.log(
        `${dryRun ? '[dry-run] ' : ''}${cn}: ${currentKey} → ${targetKey} (order_id ${pick.order_id})`
      )
    }
  }

  console.log(`\nYG2025 行数: ${yg.rows.length}`)
  console.log(`${dryRun ? '将更新' : '已更新'}: ${updated}`)
  console.log(`已是目标日期: ${skippedSame}`)
  console.log(`YG有但ERP无: ${skippedNoErp}`)
  if (ambiguous.length) {
    console.log(`ERP 同柜多订单（已按最近日期匹配）: ${ambiguous.length} 个柜号`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
