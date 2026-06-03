/**
 * 只读诊断：列出所有「已取消」订单，检查下游表是否仍有残留数据。
 * 不修改任何数据。用法：npx tsx scripts/diagnose-cancelled-orders-side-data.ts
 *
 * 同时扫描状态字段为脏值（大小写不一致、首尾空格、'canceled' 美式拼写）的订单，
 * 这些订单可能没有触发过清理逻辑。
 */
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import prisma from '../lib/prisma'

type Residue = {
  order_id: bigint
  order_number: string
  status: string | null
  pickup_management: number
  appointment_detail_lines: number
  active_appointment_detail_lines: number
  inventory_lots: number
  inbound_receipt: number
  unload_bill: number
  putaway_tasks: number
  outbound_shipment_lines: number
  invoices: number
  owned_active_appointments: number
  delivery_management_for_owned_appointments: number
}

async function diagnoseOrder(order: { order_id: bigint; order_number: string; status: string | null }): Promise<Residue> {
  const orderDetails = await prisma.order_detail.findMany({
    where: { order_id: order.order_id },
    select: { id: true },
  })
  const orderDetailIds = orderDetails.map((d) => d.id)

  const [
    pickup_management,
    appointment_detail_lines,
    active_appointment_detail_lines,
    inventory_lots,
    inbound,
    outbound_shipment_lines,
    invoices,
    ownedAppointments,
  ] = await Promise.all([
    prisma.pickup_management.count({ where: { order_id: order.order_id } }),
    orderDetailIds.length > 0
      ? prisma.appointment_detail_lines.count({
          where: { order_detail_id: { in: orderDetailIds } },
        })
      : Promise.resolve(0),
    orderDetailIds.length > 0
      ? prisma.appointment_detail_lines.count({
          where: {
            order_detail_id: { in: orderDetailIds },
            delivery_appointments: { NOT: { enabled: false } },
          },
        })
      : Promise.resolve(0),
    prisma.inventory_lots.count({ where: { order_id: order.order_id } }),
    prisma.inbound_receipt.findUnique({
      where: { order_id: order.order_id },
      select: { inbound_receipt_id: true },
    }),
    prisma.outbound_shipment_lines.count({ where: { order_id: order.order_id } }),
    prisma.invoices.count({ where: { order_id: order.order_id } }),
    prisma.delivery_appointments.findMany({
      where: { order_id: order.order_id, NOT: { enabled: false } },
      select: { appointment_id: true },
    }),
  ])

  let unload_bill = 0
  let putaway_tasks = 0
  if (inbound?.inbound_receipt_id) {
    ;[unload_bill, putaway_tasks] = await Promise.all([
      prisma.unload_bill.count({ where: { inbound_receipt_id: inbound.inbound_receipt_id } }),
      prisma.putaway_tasks.count({ where: { inbound_receipt_detail_id: inbound.inbound_receipt_id } }),
    ])
  }

  const ownedAppointmentIds = ownedAppointments.map((a) => a.appointment_id)
  let delivery_management_for_owned_appointments = 0
  if (ownedAppointmentIds.length > 0) {
    delivery_management_for_owned_appointments = await prisma.delivery_management.count({
      where: { appointment_id: { in: ownedAppointmentIds } },
    })
  }

  return {
    order_id: order.order_id,
    order_number: order.order_number,
    status: order.status,
    pickup_management,
    appointment_detail_lines,
    active_appointment_detail_lines,
    inventory_lots,
    inbound_receipt: inbound ? 1 : 0,
    unload_bill,
    putaway_tasks,
    outbound_shipment_lines,
    invoices,
    owned_active_appointments: ownedAppointmentIds.length,
    delivery_management_for_owned_appointments,
  }
}

function hasResidue(r: Residue): boolean {
  return (
    r.pickup_management > 0 ||
    r.appointment_detail_lines > 0 ||
    r.inventory_lots > 0 ||
    r.inbound_receipt > 0 ||
    r.unload_bill > 0 ||
    r.putaway_tasks > 0 ||
    r.outbound_shipment_lines > 0 ||
    r.invoices > 0 ||
    r.owned_active_appointments > 0 ||
    r.delivery_management_for_owned_appointments > 0
  )
}

async function main() {
  const allOrders = await prisma.orders.findMany({
    select: { order_id: true, order_number: true, status: true },
  })

  const cancelledOrders = allOrders.filter((o) => {
    const s = (o.status ?? '').trim().toLowerCase()
    return s === 'cancelled' || s === 'canceled'
  })

  const dirtyStatusOrders = cancelledOrders.filter((o) => o.status !== 'cancelled')

  console.log(`数据库共 ${allOrders.length} 个订单`)
  console.log(`视为已取消（cancelled / canceled，忽略大小写/空格）的订单：${cancelledOrders.length} 个`)
  if (dirtyStatusOrders.length > 0) {
    console.log(`\n⚠️ 状态字段值非规范（含空格 / 大小写不一致 / 美式拼写）：${dirtyStatusOrders.length} 个`)
    for (const o of dirtyStatusOrders) {
      console.log(`  - order_id=${o.order_id} order_number=${o.order_number} status=${JSON.stringify(o.status)}`)
    }
  } else {
    console.log('\n✅ 已取消订单的 status 字段值全部为规范的 "cancelled"')
  }

  if (cancelledOrders.length === 0) {
    console.log('\n没有已取消订单，无需检查残留。')
    return
  }

  console.log(`\n开始检查 ${cancelledOrders.length} 个订单的下游残留…`)
  const residues: Residue[] = []
  for (const o of cancelledOrders) {
    residues.push(await diagnoseOrder(o))
  }

  const dirty = residues.filter(hasResidue)

  if (dirty.length === 0) {
    console.log('\n✅ 检查完成：所有已取消订单的下游表都已清理干净，无残留。')
    return
  }

  console.log(`\n⚠️ 共 ${dirty.length} 个已取消订单存在下游残留：\n`)
  for (const r of dirty) {
    const parts: string[] = []
    if (r.pickup_management > 0) parts.push(`pickup_management=${r.pickup_management}`)
    if (r.appointment_detail_lines > 0)
      parts.push(
        `appointment_detail_lines=${r.appointment_detail_lines}` +
          (r.active_appointment_detail_lines !== r.appointment_detail_lines
            ? `(其中仍启用预约上=${r.active_appointment_detail_lines})`
            : '')
      )
    if (r.inventory_lots > 0) parts.push(`inventory_lots=${r.inventory_lots}`)
    if (r.inbound_receipt > 0) parts.push(`inbound_receipt=1`)
    if (r.unload_bill > 0) parts.push(`unload_bill=${r.unload_bill}`)
    if (r.putaway_tasks > 0) parts.push(`putaway_tasks=${r.putaway_tasks}`)
    if (r.outbound_shipment_lines > 0) parts.push(`outbound_shipment_lines=${r.outbound_shipment_lines}`)
    if (r.invoices > 0) parts.push(`invoices=${r.invoices}`)
    if (r.owned_active_appointments > 0)
      parts.push(`owned_active_appointments=${r.owned_active_appointments}`)
    if (r.delivery_management_for_owned_appointments > 0)
      parts.push(`delivery_management(本单 owner 预约)=${r.delivery_management_for_owned_appointments}`)

    console.log(
      `  - order_id=${r.order_id} order_number=${r.order_number} status=${JSON.stringify(
        r.status
      )} | ${parts.join(', ')}`
    )
  }

  console.log(
    `\n如需清理，运行：npx tsx scripts/purge-cancelled-orders-side-data.ts（仅处理 status="cancelled" 的订单）`
  )
  console.log(
    `如有美式拼写或脏值，请先把 status 规范化为 "cancelled" 后再跑清理脚本。`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
