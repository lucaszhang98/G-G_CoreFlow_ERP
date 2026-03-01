/**
 * 清理孤立的 appointment_detail_lines 记录
 * 
 * 这些记录是关联的 delivery_appointments 已被删除，但 appointment_detail_lines 记录仍然存在的情况。
 * 这可能是由于：
 * 1. 历史数据（在添加外键约束之前创建的）
 * 2. 手动删除或数据迁移导致的
 * 3. 数据库外键约束没有正确应用
 * 
 * 运行方式：npx tsx scripts/cleanup-orphaned-appointment-detail-lines.ts
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

async function main() {
  console.log('开始清理孤立的 appointment_detail_lines 记录...\n')

  // 查找所有孤立的 appointment_detail_lines 记录
  const allLines = await prisma.appointment_detail_lines.findMany({
    select: {
      id: true,
      appointment_id: true,
      order_detail_id: true,
      estimated_pallets: true,
      rejected_pallets: true,
      delivery_appointments: {
        select: {
          appointment_id: true,
          reference_number: true,
        },
      },
      order_detail: {
        select: {
          id: true,
          orders: {
            select: {
              order_number: true,
            },
          },
          locations_order_detail_delivery_location_idTolocations: {
            select: {
              location_code: true,
            },
          },
        },
      },
    },
  })

  // 找出孤立的记录（delivery_appointments 为 null）
  const orphanedLines = allLines.filter((line) => line.delivery_appointments === null)

  console.log(`找到 ${allLines.length} 条 appointment_detail_lines 记录`)
  console.log(`其中 ${orphanedLines.length} 条是孤立的（关联的预约已被删除）\n`)

  if (orphanedLines.length === 0) {
    console.log('✅ 没有发现孤立的记录，数据库状态正常。')
    await prisma.$disconnect()
    return
  }

  // 统计信息
  let totalOrphanedPallets = 0
  const details: string[] = []

  for (const line of orphanedLines) {
    const effectivePallets = (line.estimated_pallets || 0) - (line.rejected_pallets || 0)
    totalOrphanedPallets += effectivePallets

    const orderNumber = line.order_detail?.orders?.order_number || 'N/A'
    const locationCode = line.order_detail?.locations_order_detail_delivery_location_idTolocations?.location_code || 'N/A'

    details.push(`
记录ID: ${line.id}
  预约ID: ${line.appointment_id} (已删除)
  订单明细ID: ${line.order_detail_id}
  订单号: ${orderNumber}
  仓点: ${locationCode}
  预计板数: ${line.estimated_pallets || 0}
  拒收板数: ${line.rejected_pallets || 0}
  有效板数: ${effectivePallets}
`)
  }

  console.log('孤立的记录详情：')
  console.log('================================================================================')
  details.forEach((detail) => console.log(detail))
  console.log('================================================================================')
  console.log(`\n总计：${orphanedLines.length} 条孤立记录，共 ${totalOrphanedPallets} 个有效板数\n`)

  // 询问是否删除
  console.log('⚠️  警告：这些记录将被永久删除！')
  console.log('如果确认删除，请修改脚本中的 DRY_RUN 为 false 并重新运行。\n')

  const DRY_RUN = true // 设置为 false 以实际执行删除

  if (DRY_RUN) {
    console.log('🔍 当前为 DRY_RUN 模式，不会实际删除记录。')
    console.log('如需实际删除，请将脚本中的 DRY_RUN 设置为 false。')
  } else {
    console.log('🗑️  开始删除孤立的记录...')

    let deletedCount = 0
    for (const line of orphanedLines) {
      try {
        await prisma.appointment_detail_lines.delete({
          where: { id: line.id },
        })
        deletedCount++
      } catch (error: any) {
        console.error(`删除记录 ${line.id} 失败:`, error.message)
      }
    }

    console.log(`\n✅ 成功删除 ${deletedCount}/${orphanedLines.length} 条孤立记录`)

    // 重算受影响订单明细的未约板数和剩余板数
    const affectedOrderDetailIds = [...new Set(orphanedLines.map((line) => line.order_detail_id))]
    console.log(`\n开始重算 ${affectedOrderDetailIds.length} 个受影响订单明细的未约板数和剩余板数...`)

    const { recalcUnbookedRemainingForOrderDetails } = await import('../lib/services/recalc-unbooked-remaining.service')
    await recalcUnbookedRemainingForOrderDetails(affectedOrderDetailIds, prisma)

    console.log('✅ 重算完成')
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('清理失败:', e)
  await prisma.$disconnect()
  process.exit(1)
})
