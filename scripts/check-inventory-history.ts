/**
 * 检查库存历史，看看实际板数为什么是0
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
  console.log('检查订单明细 3085 的库存历史...\n')

  // 查找所有库存记录
  const inventoryLots = await prisma.inventory_lots.findMany({
    where: {
      order_detail_id: BigInt(3085),
    },
    select: {
      inventory_lot_id: true,
      pallet_count: true,
      remaining_pallet_count: true,
      unbooked_pallet_count: true,
      created_at: true,
      updated_at: true,
      inbound_receipt: {
        select: {
          inbound_receipt_id: true,
          planned_unload_at: true,
          orders: {
            select: {
              order_number: true,
            },
          },
        },
      },
    },
    orderBy: {
      created_at: 'desc',
    },
  })

  console.log(`找到 ${inventoryLots.length} 条库存记录：\n`)

  inventoryLots.forEach((lot, index) => {
    console.log(`[${index + 1}] 库存记录 ID: ${lot.inventory_lot_id}`)
    console.log(`    实际板数: ${lot.pallet_count || 0}`)
    console.log(`    剩余板数: ${lot.remaining_pallet_count ?? 'null'}`)
    console.log(`    未约板数: ${lot.unbooked_pallet_count ?? 'null'}`)
    console.log(`    创建时间: ${lot.created_at}`)
    console.log(`    更新时间: ${lot.updated_at}`)
    if (lot.inbound_receipt) {
      console.log(`    入库单ID: ${lot.inbound_receipt.inbound_receipt_id}`)
      console.log(`    订单号: ${lot.inbound_receipt.orders?.order_number || 'N/A'}`)
      console.log(`    预计拆柜: ${lot.inbound_receipt.planned_unload_at ? new Date(lot.inbound_receipt.planned_unload_at).toISOString() : 'N/A'}`)
    }
    console.log()
  })

  // 检查是否有出库记录
  const outboundShipments = await prisma.outbound_shipments.findMany({
    where: {
      delivery_appointments: {
        appointment_detail_lines: {
          some: {
            order_detail_id: BigInt(3085),
          },
        },
      },
    },
    select: {
      outbound_shipment_id: true,
      status: true,
      created_at: true,
      delivery_appointments: {
        select: {
          reference_number: true,
        },
      },
    },
  })

  if (outboundShipments.length > 0) {
    console.log(`找到 ${outboundShipments.length} 条相关出库记录：\n`)
    outboundShipments.forEach((shipment, index) => {
      console.log(`[${index + 1}] 出库记录 ID: ${shipment.outbound_shipment_id}`)
      console.log(`    预约号码: ${shipment.delivery_appointments?.reference_number || 'N/A'}`)
      console.log(`    状态: ${shipment.status || 'N/A'}`)
      console.log(`    创建时间: ${shipment.created_at}`)
      console.log()
    })
  } else {
    console.log('未找到相关出库记录\n')
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('查询失败:', e)
  await prisma.$disconnect()
  process.exit(1)
})
