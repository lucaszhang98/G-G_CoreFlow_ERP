/**
 * 一次性补齐历史「私仓」订单明细的 private_warehouse_info。
 *
 * 规则：
 * - 仅 delivery_nature =「私仓」且当前 private_warehouse_info 为空的行
 * - 日期段 = 所属订单 orders.order_date（@db.Date 日历日，UTC 年月日）
 * - 格式 GNG + YYYYMMDD + 四位随机数；全表唯一，同一日期段下四位后缀不重复
 *
 * 用法：
 *   npx tsx scripts/backfill-private-warehouse-info.ts --dry-run
 *   npx tsx scripts/backfill-private-warehouse-info.ts
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'
import prisma from '../lib/prisma'
import {
  buildPrivateWarehouseInfoCode,
  formatPrivateWarehouseInfoDateFromOrderDate,
  randomFourDigitsPrivateWarehouse,
} from '../lib/orders/private-warehouse-info'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const dryRun = process.argv.includes('--dry-run')
const CODE_LEN = 15
const CODE_RE = /^GNG(\d{8})(\d{4})$/

function seedRegistry(existingCodes: string[]) {
  const usedCodes = new Set<string>()
  const usedSuffixByDate = new Map<string, Set<string>>()

  for (const code of existingCodes) {
    if (!code) continue
    usedCodes.add(code)
    const m = code.match(CODE_RE)
    if (!m) continue
    const datePart = m[1]
    const suffix = m[2]
    let set = usedSuffixByDate.get(datePart)
    if (!set) {
      set = new Set()
      usedSuffixByDate.set(datePart, set)
    }
    set.add(suffix)
  }

  return { usedCodes, usedSuffixByDate }
}

function allocateCode(
  datePart: string,
  usedCodes: Set<string>,
  usedSuffixByDate: Map<string, Set<string>>
): string {
  let suffixSet = usedSuffixByDate.get(datePart)
  if (!suffixSet) {
    suffixSet = new Set()
    usedSuffixByDate.set(datePart, suffixSet)
  }

  for (let attempt = 0; attempt < 200; attempt++) {
    const suffix = randomFourDigitsPrivateWarehouse()
    if (suffixSet.has(suffix)) continue
    const code = buildPrivateWarehouseInfoCode(datePart, suffix)
    if (usedCodes.has(code)) continue
    suffixSet.add(suffix)
    usedCodes.add(code)
    return code
  }

  for (let n = 0; n < 10000; n++) {
    const suffix = String(n).padStart(4, '0')
    if (suffixSet.has(suffix)) continue
    const code = buildPrivateWarehouseInfoCode(datePart, suffix)
    if (usedCodes.has(code)) continue
    suffixSet.add(suffix)
    usedCodes.add(code)
    return code
  }

  throw new Error(`日期段 ${datePart} 已无可用四位后缀（已满 10000）`)
}

async function main() {
  const existingRows = await prisma.order_detail.findMany({
    where: { private_warehouse_info: { not: null } },
    select: { private_warehouse_info: true },
  })
  const existingCodes = existingRows
    .map((r) => r.private_warehouse_info)
    .filter((c): c is string => !!c)

  const { usedCodes, usedSuffixByDate } = seedRegistry(existingCodes)

  const pending = await prisma.order_detail.findMany({
    where: {
      delivery_nature: '私仓',
      private_warehouse_info: null,
    },
    select: {
      id: true,
      order_id: true,
      orders: { select: { order_date: true, order_number: true } },
    },
    orderBy: { id: 'asc' },
  })

  console.log(`已有私仓信息编码: ${existingCodes.length} 条`)
  console.log(`待补齐（私仓且为空）: ${pending.length} 条`)

  const skippedNoOrder: typeof pending = []
  const plan: { id: bigint; code: string; order_number: string | null; datePart: string }[] =
    []

  for (const row of pending) {
    const orderDate = row.orders?.order_date
    if (!orderDate) {
      skippedNoOrder.push(row)
      continue
    }
    const datePart = formatPrivateWarehouseInfoDateFromOrderDate(orderDate)
    const code = allocateCode(datePart, usedCodes, usedSuffixByDate)
    plan.push({
      id: row.id,
      code,
      order_number: row.orders?.order_number ?? null,
      datePart,
    })
  }

  if (skippedNoOrder.length > 0) {
    console.warn(
      `跳过 ${skippedNoOrder.length} 条（无订单或缺少 order_date）:`,
      skippedNoOrder.slice(0, 10).map((r) => String(r.id))
    )
  }

  const byDate = new Map<string, number>()
  for (const p of plan) {
    byDate.set(p.datePart, (byDate.get(p.datePart) ?? 0) + 1)
  }
  console.log('按订单日期段统计:', Object.fromEntries([...byDate.entries()].sort()))

  console.log('样例（前 10 条）:')
  for (const p of plan.slice(0, 10)) {
    console.log(
      `  id=${p.id} order=${p.order_number ?? '?'} → ${p.code} (长度 ${p.code.length})`
    )
  }

  if (plan.some((p) => p.code.length !== CODE_LEN)) {
    throw new Error('存在非法编码长度')
  }

  if (dryRun) {
    console.log(`\n[--dry-run] 将写入 ${plan.length} 条，未改库。去掉 --dry-run 后执行。`)
    await prisma.$disconnect()
    return
  }

  let updated = 0
  const batchSize = 50
  for (let i = 0; i < plan.length; i += batchSize) {
    const chunk = plan.slice(i, i + batchSize)
    await prisma.$transaction(
      chunk.map((p) =>
        prisma.order_detail.update({
          where: { id: p.id },
          data: { private_warehouse_info: p.code },
        })
      )
    )
    updated += chunk.length
    if (updated % 200 === 0 || updated === plan.length) {
      console.log(`已更新 ${updated} / ${plan.length}`)
    }
  }

  console.log(`\n完成：已补齐 ${updated} 条私仓信息。`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
