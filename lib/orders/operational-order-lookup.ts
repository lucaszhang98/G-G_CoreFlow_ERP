/**
 * 在途订单解析（核心业务约定）
 *
 * 已归档 (archived)、已取消 (cancelled/canceled) 的订单仅作历史保留，
 * 不参与导入、同步、初始化、按柜号查单等任何系统活动。
 *
 * 按柜号/订单号查找时：只匹配在途订单；若仅存在历史订单，视为「未找到」。
 */
import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import {
  isOrderCancelledStatus,
  ORDER_STATUS_ARCHIVED,
  ordersWhereRootExcludeArchived,
} from '@/lib/orders/order-visibility'

/** 与列表默认一致：排除完成留档与已取消 */
export const ordersWhereOperational = ordersWhereRootExcludeArchived

export type OperationalOrderRef = {
  order_id: bigint
  order_number: string
}

/**
 * 同柜号多条在途记录时保留 order_id 最大（最新）的一条。
 */
export function buildOperationalOrderByNumberMap(
  orders: OperationalOrderRef[]
): Map<string, OperationalOrderRef> {
  const map = new Map<string, OperationalOrderRef>()
  for (const o of orders) {
    const key = o.order_number?.trim()
    if (!key || map.has(key)) continue
    map.set(key, o)
  }
  return map
}

export async function loadOperationalOrderByNumberMap(): Promise<
  Map<string, OperationalOrderRef>
> {
  const orders = await prisma.orders.findMany({
    where: ordersWhereOperational(),
    select: { order_id: true, order_number: true },
    orderBy: { order_id: 'desc' },
  })
  return buildOperationalOrderByNumberMap(orders)
}

function orderNumberEqualsWhere(
  orderNumber: string
): Prisma.ordersWhereInput {
  const key = orderNumber.trim()
  return {
    order_number: { equals: key, mode: 'insensitive' },
  }
}

/** 按柜号查唯一在途订单；无匹配或仅有历史订单时返回 null */
export async function findOperationalOrderByNumber<
  S extends Prisma.ordersSelect,
>(args: {
  orderNumber: string
  select: S
}): Promise<Prisma.ordersGetPayload<{ select: S }> | null> {
  return prisma.orders.findFirst({
    where: {
      AND: [ordersWhereOperational(), orderNumberEqualsWhere(args.orderNumber)],
    },
    select: args.select,
    orderBy: { order_id: 'desc' },
  })
}

export function isOrderOperationalStatus(
  status: string | null | undefined
): boolean {
  if (status == null) return true
  const t = String(status).trim()
  if (t.toLowerCase() === ORDER_STATUS_ARCHIVED) return false
  if (isOrderCancelledStatus(status)) return false
  return true
}

/**
 * 导入/校验用：柜号未映射到在途订单时的说明文案。
 */
export async function formatOperationalOrderNotFoundMessage(
  orderNumber: string
): Promise<string> {
  const key = orderNumber.trim()
  const operational = await findOperationalOrderByNumber({
    orderNumber: key,
    select: { order_id: true },
  })
  if (operational) return ''

  const any = await prisma.orders.findFirst({
    where: orderNumberEqualsWhere(key),
    select: { status: true },
    orderBy: { order_id: 'desc' },
  })
  if (!any) {
    return `未找到柜号对应的在途订单：「${key}」`
  }
  return `未找到在途订单：柜号「${key}」仅存在于完成留档或已取消记录，系统不会对其做任何更新`
}
