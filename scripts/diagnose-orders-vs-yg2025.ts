/**
 * 对比 ERP 订单管理柜号 vs Google 表格 YG2025 清单。
 * 运行：npx tsx scripts/diagnose-orders-vs-yg2025.ts
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
import prisma from '../lib/prisma'
import {
  fetchYg2025ImportCheck,
  normalizeContainerNumber,
  isOrderDateWithinTolerance,
  parseSheetOrderDate,
  toOrderDateKey,
} from '../lib/google/oak-yg2025-sheet'
import { ordersWhereRootExcludeArchived } from '../lib/orders/order-visibility'

dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const CUTOFF = new Date(Date.UTC(2026, 3, 1))

async function main() {
  const erpOrders = await prisma.orders.findMany({
    where: ordersWhereRootExcludeArchived(),
    select: {
      order_id: true,
      order_number: true,
      order_date: true,
      status: true,
      customers: { select: { code: true } },
    },
    orderBy: { order_date: 'desc' },
  })

  const yg = await fetchYg2025ImportCheck()

  /** YG2025 中出现的柜号（任意日期行） */
  const ygContainers = new Set<string>()
  /** 柜号 -> YG2025 上的订单日期列表 */
  const ygDatesByContainer = new Map<string, Date[]>()

  for (const row of yg.rows) {
    const cn = normalizeContainerNumber(row.containerNumber)
    if (!cn) continue
    ygContainers.add(cn)
    const parsed = parseSheetOrderDate(row.orderDateKey) ?? parseSheetOrderDate(row.orderDate)
    if (parsed) {
      const list = ygDatesByContainer.get(cn) ?? []
      list.push(parsed)
      ygDatesByContainer.set(cn, list)
    }
  }

  const erpSinceCutoff = erpOrders.filter((o) => o.order_date >= CUTOFF)
  const erpAllContainers = new Set(
    erpOrders.map((o) => normalizeContainerNumber(o.order_number ?? '')).filter(Boolean)
  )
  const erpRecentContainers = new Set(
    erpSinceCutoff.map((o) => normalizeContainerNumber(o.order_number ?? '')).filter(Boolean)
  )

  type MissingRow = {
    order_number: string
    order_date: string
    status: string | null
    customer_code: string | null
    inYg2025: boolean
    dateMatchInYg: boolean
  }

  const missingFromYg: MissingRow[] = []
  const missingDateMatch: MissingRow[] = []

  for (const o of erpSinceCutoff) {
    const cn = normalizeContainerNumber(o.order_number ?? '')
    if (!cn) continue
    const inYg = ygContainers.has(cn)
    const ygDates = ygDatesByContainer.get(cn) ?? []
    const dateMatch = ygDates.some((d) => isOrderDateWithinTolerance(d, o.order_date))

    const row: MissingRow = {
      order_number: cn,
      order_date: toOrderDateKey(o.order_date),
      status: o.status,
      customer_code: o.customers?.code ?? null,
      inYg2025: inYg,
      dateMatchInYg: dateMatch,
    }

    if (!inYg) missingFromYg.push(row)
    else if (!dateMatch) missingDateMatch.push(row)
  }

  const ygNotInErp = yg.rows.filter((r) => !r.imported)

  console.log('=== 数据源 ===')
  console.log(`Google 表格：${yg.spreadsheetTitle} / ${yg.sheetName}`)
  console.log(`YG2025 有效行（订单日期 ≥ 2026-04-01）：${yg.total}`)
  console.log(`ERP 在途订单（排除留档/取消）：${erpOrders.length} 条`)
  console.log(`ERP 其中订单日期 ≥ 2026-04-01：${erpSinceCutoff.length} 条`)
  console.log(`YG2025 去重柜号：${ygContainers.size}`)
  console.log(`ERP 去重柜号（全部）：${erpAllContainers.size}`)
  console.log(`ERP 去重柜号（≥2026-04-01）：${erpRecentContainers.size}`)

  console.log('\n=== 结论（ERP ≥2026-04-01 → YG2025）===')
  const erpRecentWithCn = erpSinceCutoff.filter((o) =>
    Boolean(normalizeContainerNumber(o.order_number ?? ''))
  )
  const foundInYg = erpRecentWithCn.filter((o) =>
    ygContainers.has(normalizeContainerNumber(o.order_number ?? ''))
  ).length
  const withDateMatch = erpRecentWithCn.filter((o) => {
    const cn = normalizeContainerNumber(o.order_number ?? '')
    const ygDates = ygDatesByContainer.get(cn) ?? []
    return ygDates.some((d) => isOrderDateWithinTolerance(d, o.order_date))
  }).length

  console.log(
    `柜号在 YG2025 出现过：${foundInYg}/${erpRecentWithCn.length}（${pct(foundInYg, erpRecentWithCn.length)}）`
  )
  console.log(
    `柜号+日期 ±60 天匹配（邮件助手「已导入」规则）：${withDateMatch}/${erpRecentWithCn.length}（${pct(withDateMatch, erpRecentWithCn.length)}）`
  )

  if (missingFromYg.length > 0) {
    console.log(`\n=== ERP 有、YG2025 无柜号（${missingFromYg.length} 条，展示前 30）===`)
    for (const r of missingFromYg.slice(0, 30)) {
      console.log(
        `  ${r.order_number}  订单日 ${r.order_date}  客户 ${r.customer_code ?? '-'}  状态 ${r.status ?? '-'}`
      )
    }
  } else {
    console.log('\n✓ 所有 ≥2026-04-01 的 ERP 订单柜号均在 YG2025 中出现')
  }

  if (missingDateMatch.length > 0) {
    console.log(
      `\n=== 柜号在 YG2025 有，但日期相差 >60 天（${missingDateMatch.length} 条，展示前 20）===`
    )
    for (const r of missingDateMatch.slice(0, 20)) {
      const ygDates = (ygDatesByContainer.get(r.order_number) ?? []).map((d) => toOrderDateKey(d))
      console.log(
        `  ${r.order_number}  ERP ${r.order_date}  YG2025 [${ygDates.join(', ')}]  客户 ${r.customer_code ?? '-'}`
      )
    }
  }

  const erpBeforeCutoff = erpOrders.filter((o) => o.order_date < CUTOFF)
  const beforeCutoffNotInYg = erpBeforeCutoff.filter(
    (o) => !ygContainers.has(normalizeContainerNumber(o.order_number ?? ''))
  )
  console.log(`\n=== 补充：订单日期 < 2026-04-01 的 ERP 订单 ===`)
  console.log(`共 ${erpBeforeCutoff.length} 条（YG2025 本身不展示此日期之前）`)
  console.log(`其中柜号也不在 YG2025 任意行：${beforeCutoffNotInYg.length} 条`)

  console.log(`\n=== 反向：YG2025 显示「未导入」===`)
  console.log(`${yg.notImportedCount}/${yg.total} 行（邮件助手界面上的未导入数）`)
}

function pct(n: number, total: number): string {
  if (total === 0) return '—'
  return `${((n / total) * 100).toFixed(1)}%`
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
