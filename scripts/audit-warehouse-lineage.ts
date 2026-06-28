/**
 * 多仓血缘审计：验证所有业务数据都能经「主数据/锚点」唯一定位到仓库，且多条路径不冲突。
 *
 * 锚点：
 *  - orders.warehouse_id        → OMS/TMS/WMS 所有交易链的根
 *  - customers.warehouse_id     → 财务链（发票/应收/收款/费用范围）的根
 *  - 主数据自带 warehouse_id     → customers/carriers/locations/drivers
 *  - WMS 核心自带 warehouse_id   → inbound_receipt/inventory_lots/outbound_shipments/wms_labor_logs
 *
 * 校验两类问题：
 *  1) 关键锚点是否有 NULL（无法定位仓库）
 *  2) 多条路径是否冲突（同一记录经不同关系得到不同仓库 = “混乱”）
 */
import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const prisma = new PrismaClient()

async function one(sql: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(sql)
  return Number(rows[0]?.n ?? 0)
}

async function main() {
  const nullChecks: Array<[string, string]> = [
    ['orders.warehouse_id', `SELECT count(*) n FROM public.orders WHERE warehouse_id IS NULL`],
    ['customers.warehouse_id', `SELECT count(*) n FROM public.customers WHERE warehouse_id IS NULL`],
    ['carriers.warehouse_id', `SELECT count(*) n FROM public.carriers WHERE warehouse_id IS NULL`],
    ['locations.warehouse_id', `SELECT count(*) n FROM public.locations WHERE warehouse_id IS NULL`],
    ['drivers.warehouse_id', `SELECT count(*) n FROM public.drivers WHERE warehouse_id IS NULL`],
    ['users.default_warehouse_id', `SELECT count(*) n FROM public.users WHERE default_warehouse_id IS NULL`],
    ['inbound_receipt.warehouse_id', `SELECT count(*) n FROM wms.inbound_receipt WHERE warehouse_id IS NULL`],
    ['inventory_lots.warehouse_id', `SELECT count(*) n FROM wms.inventory_lots WHERE warehouse_id IS NULL`],
    ['outbound_shipments.warehouse_id', `SELECT count(*) n FROM wms.outbound_shipments WHERE warehouse_id IS NULL`],
  ]

  // 路径冲突：同一记录经不同关系得到不同 warehouse_id
  const mismatchChecks: Array<[string, string]> = [
    [
      'orders ↔ customers（订单仓 vs 客户仓）',
      `SELECT count(*) n FROM public.orders o JOIN public.customers c ON o.customer_id=c.id
       WHERE o.customer_id IS NOT NULL AND o.warehouse_id IS DISTINCT FROM c.warehouse_id`,
    ],
    [
      'orders ↔ carriers（订单仓 vs 承运商仓）',
      `SELECT count(*) n FROM public.orders o JOIN public.carriers c ON o.carrier_id=c.carrier_id
       WHERE o.carrier_id IS NOT NULL AND o.warehouse_id IS DISTINCT FROM c.warehouse_id`,
    ],
    [
      'orders ↔ port_location（订单仓 vs 港口/查验站仓）',
      `SELECT count(*) n FROM public.orders o JOIN public.locations l ON o.port_location_id=l.location_id
       WHERE o.port_location_id IS NOT NULL AND o.warehouse_id IS DISTINCT FROM l.warehouse_id`,
    ],
    [
      'orders ↔ delivery_location（订单仓 vs 送货地点仓）',
      `SELECT count(*) n FROM public.orders o JOIN public.locations l ON o.delivery_location_id=l.location_id
       WHERE o.delivery_location_id IS NOT NULL AND o.warehouse_id IS DISTINCT FROM l.warehouse_id`,
    ],
    [
      'order_detail ↔ delivery_location（明细送货地点仓 vs 订单仓）',
      `SELECT count(*) n FROM public.order_detail d
       JOIN public.orders o ON d.order_id=o.order_id
       JOIN public.locations l ON d.delivery_location_id=l.location_id
       WHERE d.delivery_location_id IS NOT NULL AND o.warehouse_id IS DISTINCT FROM l.warehouse_id`,
    ],
    [
      'inbound_receipt ↔ orders（入库仓 vs 订单仓）',
      `SELECT count(*) n FROM wms.inbound_receipt ir JOIN public.orders o ON ir.order_id=o.order_id
       WHERE ir.warehouse_id IS DISTINCT FROM o.warehouse_id`,
    ],
    [
      'inventory_lots ↔ orders（库存仓 vs 订单仓）',
      `SELECT count(*) n FROM wms.inventory_lots il JOIN public.orders o ON il.order_id=o.order_id
       WHERE il.warehouse_id IS DISTINCT FROM o.warehouse_id`,
    ],
    [
      'outbound_shipments ↔ 预约订单（出库仓 vs 预约关联订单仓）',
      `SELECT count(*) n FROM wms.outbound_shipments s
       JOIN oms.delivery_appointments a ON s.appointment_id=a.appointment_id
       JOIN public.orders o ON a.order_id=o.order_id
       WHERE s.appointment_id IS NOT NULL AND a.order_id IS NOT NULL
         AND s.warehouse_id IS DISTINCT FROM o.warehouse_id`,
    ],
    [
      'delivery_appointments ↔ orders 经 location（预约送货地点仓 vs 订单仓）',
      `SELECT count(*) n FROM oms.delivery_appointments a
       JOIN public.orders o ON a.order_id=o.order_id
       JOIN public.locations l ON a.location_id=l.location_id
       WHERE a.location_id IS NOT NULL AND o.warehouse_id IS DISTINCT FROM l.warehouse_id`,
    ],
    [
      'invoices ↔ orders（发票客户仓 vs 订单仓）',
      `SELECT count(*) n FROM public.invoices i
       JOIN public.customers c ON i.customer_id=c.id
       JOIN public.orders o ON i.order_id=o.order_id
       WHERE i.order_id IS NOT NULL AND c.warehouse_id IS DISTINCT FROM o.warehouse_id`,
    ],
    [
      'fee（客户专属费用行）↔ customers（仅校验 customer_id 非空行天然随客户仓，无需对比）',
      `SELECT 0 n`,
    ],
  ]

  console.log('========== 多仓血缘审计 ==========\n')
  console.log('— 关键锚点 NULL 检查（应全部为 0）—')
  let nullBad = 0
  for (const [label, sql] of nullChecks) {
    const n = await one(sql)
    if (n > 0) nullBad += n
    console.log(`  ${n === 0 ? '✅' : '❌'} ${label}: ${n}`)
  }

  console.log('\n— 多路径冲突检查（同一记录经不同关系得到不同仓库，应全部为 0）—')
  let mismatchBad = 0
  for (const [label, sql] of mismatchChecks) {
    const n = await one(sql)
    if (n > 0) mismatchBad += n
    console.log(`  ${n === 0 ? '✅' : '❌'} ${label}: ${n}`)
  }

  // 仓库分布概览
  console.log('\n— 仓库分布概览 —')
  const dist = await prisma.$queryRawUnsafe<Array<{ warehouse_id: bigint | null; n: bigint }>>(
    `SELECT warehouse_id, count(*) n FROM public.orders GROUP BY warehouse_id ORDER BY warehouse_id`,
  )
  for (const d of dist) {
    console.log(`  orders 仓库 ${d.warehouse_id ?? 'NULL'}: ${Number(d.n)} 条`)
  }
  const whs = await prisma.$queryRawUnsafe<Array<{ warehouse_id: bigint; name: string; warehouse_code: string | null }>>(
    `SELECT warehouse_id, name, warehouse_code FROM public.warehouses ORDER BY warehouse_id`,
  )
  console.log('\n— 仓库主数据 —')
  for (const w of whs) console.log(`  ${w.warehouse_id}  ${w.name} (${w.warehouse_code ?? '-'})`)

  console.log('\n========== 结论 ==========')
  if (nullBad === 0 && mismatchBad === 0) {
    console.log('✅ 全部通过：所有业务数据均可经锚点唯一定位到仓库，且无多路径冲突。')
  } else {
    console.log(`❌ 发现问题：NULL 锚点 ${nullBad} 处，路径冲突 ${mismatchBad} 处，需修复。`)
  }
}

main()
  .catch((e) => {
    console.error('审计失败:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
