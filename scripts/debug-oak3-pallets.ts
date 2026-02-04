/**
 * 独立定位：入库管理中 FBIU7916729 的 OAK3 板数计算
 * 用法: npx tsx scripts/debug-oak3-pallets.ts
 */
import prisma from '../lib/prisma'

const ORDER_NUMBER = 'FBIU7916729'
const LOCATION_CODE = 'OAK3'

async function main() {
  console.log('=== 查找订单', ORDER_NUMBER, '===')
  const order = await prisma.orders.findFirst({
    where: { order_number: ORDER_NUMBER },
    select: { order_id: true, order_number: true },
  })
  if (!order) {
    console.log('未找到订单', ORDER_NUMBER)
    return
  }
  const orderId = order.order_id
  console.log('订单ID:', orderId.toString())

  console.log('\n=== 查找送仓地点为', LOCATION_CODE, '的订单明细 ===')
  const detail = await prisma.order_detail.findFirst({
    where: {
      order_id: orderId,
      locations_order_detail_delivery_location_idTolocations: {
        location_code: LOCATION_CODE,
      },
    },
    select: {
      id: true,
      order_id: true,
      estimated_pallets: true,
      delivery_location_id: true,
      locations_order_detail_delivery_location_idTolocations: {
        select: { location_code: true, name: true },
      },
    },
  })
  if (!detail) {
    console.log('未找到送仓地点为', LOCATION_CODE, '的订单明细')
    return
  }
  const orderDetailId = detail.id
  console.log('订单明细ID (order_detail_id):', orderDetailId.toString())
  console.log('送仓地点:', detail.locations_order_detail_delivery_location_idTolocations?.location_code)
  console.log('预估板数:', detail.estimated_pallets)

  console.log('\n=== 该仓点下的 inventory_lots ===')
  const lots = await prisma.inventory_lots.findMany({
    where: { order_detail_id: orderDetailId },
    select: {
      inventory_lot_id: true,
      order_detail_id: true,
      pallet_count: true,
      remaining_pallet_count: true,
      unbooked_pallet_count: true,
    },
  })
  const totalPalletCount = lots.reduce((s, l) => s + (l.pallet_count || 0), 0)
  console.log('条数:', lots.length)
  lots.forEach((l, i) => {
    console.log(
      `  lot ${i + 1}: pallet_count=${l.pallet_count}, remaining=${l.remaining_pallet_count}, unbooked=${l.unbooked_pallet_count}`
    )
  })
  console.log('实际板数 (pallet_count 之和):', totalPalletCount)

  console.log('\n=== 该仓点下的 appointment_detail_lines ===')
  const lines = await prisma.appointment_detail_lines.findMany({
    where: { order_detail_id: orderDetailId },
    select: {
      id: true,
      appointment_id: true,
      estimated_pallets: true,
      rejected_pallets: true,
      delivery_appointments: {
        select: { reference_number: true, confirmed_start: true },
      },
    },
  })
  console.log('条数:', lines.length)
  const effective = (est: number, rej?: number | null) => (est || 0) - (rej ?? 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let totalEffective = 0
  let totalExpiredEffective = 0
  lines.forEach((l, i) => {
    const est = l.estimated_pallets ?? 0
    const rej = l.rejected_pallets ?? 0
    const eff = effective(est, rej)
    totalEffective += eff
    const start = l.delivery_appointments?.confirmed_start
    let expired = false
    if (start) {
      const d = new Date(start)
      d.setHours(0, 0, 0, 0)
      expired = d < today
      if (expired) totalExpiredEffective += eff
    }
    console.log(
      `  line ${i + 1}: estimated=${est}, rejected=${rej}, effective=${eff}, confirmed_start=${start?.toISOString?.() ?? 'null'}, 已过期=${expired}`
    )
  })
  console.log('所有预约有效板数之和:', totalEffective)
  console.log('已过期预约有效板数之和:', totalExpiredEffective)

  const unbooked = totalPalletCount - totalEffective
  const remaining = Math.max(0, totalPalletCount - totalExpiredEffective)
  console.log('\n=== 按前端公式计算 ===')
  console.log('未约板数 = 实际板数 - 所有预约有效板数 =', totalPalletCount, '-', totalEffective, '=', unbooked)
  console.log('剩余板数 = 实际板数 - 已过期预约有效板数 =', totalPalletCount, '-', totalExpiredEffective, '=', remaining)

  if (lots.length > 0) {
    const dbUnbooked = lots[0].unbooked_pallet_count
    const dbRemaining = lots[0].remaining_pallet_count
    console.log('\n=== 与数据库字段对比 (取第一条 lot) ===')
    console.log('DB unbooked_pallet_count:', dbUnbooked, '计算值:', unbooked, dbUnbooked !== unbooked ? '❌ 不一致' : '✓')
    console.log('DB remaining_pallet_count:', dbRemaining, '计算值:', remaining, dbRemaining !== remaining ? '❌ 不一致' : '✓')
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
