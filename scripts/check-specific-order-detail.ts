/**
 * 检查特定订单明细的数据情况
 * 用于调试 TXGU7529397 SMF6 AMZ 的问题
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
  console.log('查找订单明细：TXGU7529397 SMF6 AMZ\n')

  // 1. 先找到订单
  const order = await prisma.orders.findFirst({
    where: {
      order_number: {
        contains: 'TXGU7529397',
        mode: 'insensitive',
      },
    },
    select: {
      order_id: true,
      order_number: true,
    },
  })

  if (!order) {
    console.log('❌ 未找到订单 TXGU7529397')
    await prisma.$disconnect()
    return
  }

  console.log(`找到订单：${order.order_number} (ID: ${order.order_id})\n`)

  // 2. 找到仓点 SMF6
  const location = await prisma.locations.findFirst({
    where: {
      location_code: 'SMF6',
    },
    select: {
      location_id: true,
      location_code: true,
      name: true,
    },
  })

  if (!location) {
    console.log('❌ 未找到仓点 SMF6')
    await prisma.$disconnect()
    return
  }

  console.log(`找到仓点：${location.location_code} - ${location.name} (ID: ${location.location_id})\n`)

  // 3. 查找订单明细
  const orderDetail = await prisma.order_detail.findFirst({
    where: {
      order_id: order.order_id,
      delivery_location_id: location.location_id,
      delivery_nature: 'AMZ',
    },
    include: {
      orders: {
        select: {
          order_number: true,
        },
      },
      locations_order_detail_delivery_location_idTolocations: {
        select: {
          location_code: true,
          name: true,
        },
      },
      inventory_lots: {
        select: {
          inventory_lot_id: true,
          pallet_count: true,
          remaining_pallet_count: true,
          unbooked_pallet_count: true,
        },
        orderBy: [
          { pallet_count: 'desc' },
          { created_at: 'desc' },
        ],
        take: 1,
      },
      appointment_detail_lines: {
        include: {
          delivery_appointments: {
            select: {
              appointment_id: true,
              reference_number: true,
              confirmed_start: true,
              status: true,
            },
          },
        },
      },
    },
  })

  if (!orderDetail) {
    console.log('❌ 未找到订单明细')
    await prisma.$disconnect()
    return
  }

  console.log('================================================================================')
  console.log('订单明细信息：')
  console.log('================================================================================')
  console.log(`ID: ${orderDetail.id}`)
  console.log(`订单号: ${orderDetail.orders?.order_number || 'N/A'}`)
  console.log(`仓点: ${orderDetail.locations_order_detail_delivery_location_idTolocations?.location_code || 'N/A'} - ${orderDetail.locations_order_detail_delivery_location_idTolocations?.name || 'N/A'}`)
  console.log(`送仓性质: ${orderDetail.delivery_nature || 'N/A'}`)
  console.log(`预计板数: ${orderDetail.estimated_pallets || 0}`)
  console.log(`剩余板数（数据库）: ${orderDetail.remaining_pallets ?? 'null'}`)
  console.log()

  // 库存信息
  const inventoryLot = orderDetail.inventory_lots[0] || null
  if (inventoryLot) {
    console.log('库存信息：')
    console.log(`  实际板数: ${inventoryLot.pallet_count || 0}`)
    console.log(`  剩余板数（数据库）: ${inventoryLot.remaining_pallet_count ?? 'null'}`)
    console.log(`  未约板数（数据库）: ${inventoryLot.unbooked_pallet_count ?? 'null'}`)
    console.log()
  } else {
    console.log('库存信息：未入库')
    console.log()
  }

  // 预约明细信息
  console.log('预约明细记录：')
  console.log(`  总数: ${orderDetail.appointment_detail_lines.length}`)
  
  const validAppointments = orderDetail.appointment_detail_lines.filter(
    (line) => line.delivery_appointments !== null
  )
  const orphanedLines = orderDetail.appointment_detail_lines.filter(
    (line) => line.delivery_appointments === null
  )

  console.log(`  有效预约: ${validAppointments.length}`)
  console.log(`  孤立记录: ${orphanedLines.length}`)
  console.log()

  if (orderDetail.appointment_detail_lines.length > 0) {
    console.log('详细预约明细：')
    orderDetail.appointment_detail_lines.forEach((line, index) => {
      const isOrphaned = line.delivery_appointments === null
      const effectivePallets = (line.estimated_pallets || 0) - (line.rejected_pallets || 0)
      console.log(`\n  [${index + 1}] 记录ID: ${line.id}`)
      console.log(`      预约ID: ${line.appointment_id}`)
      if (isOrphaned) {
        console.log(`      ⚠️  状态: 孤立记录（关联的预约已被删除）`)
      } else {
        console.log(`      预约号码: ${line.delivery_appointments?.reference_number || 'N/A'}`)
        console.log(`      送货时间: ${line.delivery_appointments?.confirmed_start ? new Date(line.delivery_appointments.confirmed_start).toISOString() : 'N/A'}`)
        console.log(`      状态: ${line.delivery_appointments?.status || 'N/A'}`)
      }
      console.log(`      预计板数: ${line.estimated_pallets || 0}`)
      console.log(`      拒收板数: ${line.rejected_pallets || 0}`)
      console.log(`      有效板数: ${effectivePallets}`)
    })
    console.log()
  }

  // 计算未约板数
  const effective = (est: number, rej?: number | null) => (est || 0) - (rej ?? 0)
  const totalEffectivePallets = validAppointments.reduce(
    (sum, line) => sum + effective(line.estimated_pallets, line.rejected_pallets),
    0
  )
  const totalOrphanedPallets = orphanedLines.reduce(
    (sum, line) => sum + effective(line.estimated_pallets, line.rejected_pallets),
    0
  )

  const calculatedUnbookedPallets = inventoryLot
    ? (inventoryLot.pallet_count || 0) - totalEffectivePallets
    : (orderDetail.estimated_pallets || 0) - totalEffectivePallets

  console.log('================================================================================')
  console.log('计算结果：')
  console.log('================================================================================')
  console.log(`有效预约的有效板数之和: ${totalEffectivePallets}`)
  if (orphanedLines.length > 0) {
    console.log(`孤立记录的有效板数之和: ${totalOrphanedPallets} (⚠️ 这些不应该被计入)`)
  }
  console.log(`计算出的未约板数: ${calculatedUnbookedPallets}`)
  console.log(`数据库中的未约板数: ${inventoryLot?.unbooked_pallet_count ?? orderDetail.remaining_pallets ?? 'null'}`)
  console.log()

  if (orphanedLines.length > 0) {
    console.log('⚠️  发现孤立记录！这些记录的板数可能被错误地计入了数据库中的未约板数。')
    console.log('   建议运行清理脚本删除这些记录，然后重算未约板数。')
  } else if (calculatedUnbookedPallets !== (inventoryLot?.unbooked_pallet_count ?? orderDetail.remaining_pallets ?? 0)) {
    console.log('⚠️  计算出的未约板数与数据库中的值不一致！')
    console.log('   建议运行重算服务更新数据库中的值。')
  } else if (validAppointments.length === 0 && calculatedUnbookedPallets === 0 && (orderDetail.estimated_pallets || 0) > 0) {
    console.log('⚠️  没有有效预约，但未约板数为0，而预计板数 > 0！')
    console.log('   这可能是数据库中的值没有正确更新。')
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('查询失败:', e)
  await prisma.$disconnect()
  process.exit(1)
})
