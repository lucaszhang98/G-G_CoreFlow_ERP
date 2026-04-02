/**
 * 保证每条预约在 tms.delivery_management 中有且仅有一条对应记录（appointment_id 唯一）。
 * 直送时尽量写入柜号（order_number）：优先 appointment.order_id，否则第一条预约明细上的订单。
 */

import { Prisma, type PrismaClient } from '@prisma/client'

/** 支持 prisma 根客户端或 $transaction 回调里的 tx */
type Db = Pick<
  PrismaClient,
  'delivery_management' | 'orders' | 'appointment_detail_lines'
>

export async function resolveZhisongContainerNumber(
  db: Db,
  params: { order_id: bigint | null | undefined; appointment_id: bigint }
): Promise<string | null> {
  if (params.order_id) {
    const order = await db.orders.findUnique({
      where: { order_id: params.order_id },
      select: { order_number: true },
    })
    if (order?.order_number) return order.order_number
  }
  const line = await db.appointment_detail_lines.findFirst({
    where: { appointment_id: params.appointment_id },
    select: {
      order_detail: { select: { orders: { select: { order_number: true } } } },
    },
  })
  return line?.order_detail?.orders?.order_number ?? null
}

export async function ensureDeliveryManagementRow(
  db: Db,
  params: {
    appointment_id: bigint
    delivery_method: string | null | undefined
    order_id: bigint | null | undefined
    created_by?: bigint | null
    updated_by?: bigint | null
  }
): Promise<{ created: boolean }> {
  const existing = await db.delivery_management.findUnique({
    where: { appointment_id: params.appointment_id },
    select: { delivery_id: true },
  })
  if (existing) return { created: false }

  let containerNumber: string | null = null
  if (params.delivery_method === '直送') {
    containerNumber = await resolveZhisongContainerNumber(db, {
      order_id: params.order_id ?? null,
      appointment_id: params.appointment_id,
    })
  }

  try {
    await db.delivery_management.create({
      data: {
        appointment_id: params.appointment_id,
        container_number: containerNumber,
        created_by: params.created_by ?? null,
        updated_by: params.updated_by ?? null,
      } as any,
    })
    return { created: true }
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { created: false }
    }
    throw e
  }
}

/**
 * 批量补建：有预约、无送仓管理行的记录。用于列表 GET 首屏自愈与一次性修复。
 */
export async function repairDeliveryManagementOrphans(
  db: PrismaClient,
  options?: { batchSize?: number; maxTotal?: number }
): Promise<{ repaired: number }> {
  const batchSize = options?.batchSize ?? 400
  const maxTotal = options?.maxTotal ?? 100_000
  let repaired = 0

  while (repaired < maxTotal) {
    const orphans = await db.$queryRawUnsafe(
      `SELECT a.appointment_id
       FROM oms.delivery_appointments a
       LEFT JOIN tms.delivery_management d ON d.appointment_id = a.appointment_id
       WHERE d.delivery_id IS NULL
       LIMIT $1`,
      batchSize
    ) as { appointment_id: bigint }[]

    if (orphans.length === 0) break

    const ids = orphans.map((o) => o.appointment_id)
    const appts = await db.delivery_appointments.findMany({
      where: { appointment_id: { in: ids } },
      select: {
        appointment_id: true,
        delivery_method: true,
        order_id: true,
      },
    })

    for (const a of appts) {
      const r = await ensureDeliveryManagementRow(db, {
        appointment_id: a.appointment_id,
        delivery_method: a.delivery_method,
        order_id: a.order_id,
      })
      if (r.created) repaired++
    }

    if (orphans.length < batchSize) break
  }

  return { repaired }
}
