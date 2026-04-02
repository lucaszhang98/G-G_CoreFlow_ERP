/**
 * 为「有预约、无送仓管理行」的记录补建 tms.delivery_management。
 *
 * 背景：送仓管理列表只查 delivery_management；该行仅在
 * - 新建预约 POST /api/oms/appointments 成功后的 try 块里创建，或
 * - 预约 Excel 导入事务里 INSERT
 * 历史预约若在上述逻辑上线前创建、或创建送仓行时曾失败（仅打 warn），则预约表里仍有直送，但送仓管理里没有对应行。
 *
 * 用法：npx tsx scripts/backfill-delivery-management.ts
 * 加 --dry-run 只打印统计与样例，不写库。
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'
import prisma from '../lib/prisma'
import { repairDeliveryManagementOrphans } from '../lib/services/ensure-delivery-management'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const dryRun = process.argv.includes('--dry-run')

async function main() {
  const orphanRows = await prisma.$queryRaw<{ appointment_id: bigint }[]>`
    SELECT a.appointment_id
    FROM oms.delivery_appointments a
    LEFT JOIN tms.delivery_management d ON d.appointment_id = a.appointment_id
    WHERE d.delivery_id IS NULL
  `

  const totalOrphans = orphanRows.length
  console.log(`无送仓管理行的预约数: ${totalOrphans}`)
  if (totalOrphans === 0) {
    await prisma.$disconnect()
    return
  }

  const ids = orphanRows.map((r) => r.appointment_id)
  const appointments = await prisma.delivery_appointments.findMany({
    where: { appointment_id: { in: ids } },
    select: {
      appointment_id: true,
      delivery_method: true,
      order_id: true,
      reference_number: true,
      orders: { select: { order_number: true } },
      appointment_detail_lines: {
        take: 1,
        select: {
          order_detail: {
            select: {
              orders: { select: { order_number: true } },
            },
          },
        },
      },
    },
  })

  const zhisong = appointments.filter((a) => a.delivery_method === '直送')
  console.log(`其中派送方式为「直送」: ${zhisong.length}`)

  const sample = zhisong.slice(0, 15).map((a) => ({
    appointment_id: String(a.appointment_id),
    reference_number: a.reference_number,
    order_id: a.order_id != null ? String(a.order_id) : null,
  }))
  console.log('直送样例（前 15 条）:', JSON.stringify(sample, null, 2))

  if (dryRun) {
    console.log('\n[--dry-run] 未写入数据库。去掉 --dry-run 后执行补全。')
    return
  }

  const { repaired } = await repairDeliveryManagementOrphans(prisma)
  console.log(`\n已补建 delivery_management 行数: ${repaired}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
