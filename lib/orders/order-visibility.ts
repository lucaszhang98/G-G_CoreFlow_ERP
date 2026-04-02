/**
 * 订单可见性约定 — 与列表默认排除「完成留档」「已取消」、?includeArchived=true 查看历史 对齐。
 * 已取消订单在业务侧还应通过 cancelled-order-cleanup 清掉下游表数据；此处过滤用于列表与历史切换一致。
 *
 * 使用处：各 GET 列表在默认情况下对关联 orders 或 orders 主表追加非 archived / 非 cancelled 条件。
 * 未在此处理的接口：部分出库列表（产品要求暂缓）；订单主表列表由 createListHandler 处理。
 */
import type { Prisma } from '@prisma/client'

/** 与 lib/crud/configs/orders、Prisma schema 中 status 字符串一致 */
export const ORDER_STATUS_ARCHIVED = 'archived' as const
export const ORDER_STATUS_CANCELLED = 'cancelled' as const

/** 默认业务列表中排除的订单状态（与 includeArchived=true 时的「历史模式」相对） */
export const ORDER_STATUSES_EXCLUDED_FROM_OPERATIONAL_LISTS = [
  ORDER_STATUS_ARCHIVED,
  ORDER_STATUS_CANCELLED,
] as const

/** URL / searchParams：是否包含完成留档订单（历史模式） */
export function parseIncludeArchived(searchParams: URLSearchParams): boolean {
  const v = searchParams.get('includeArchived')
  if (!v) return false
  const lower = v.toLowerCase()
  return lower === 'true' || lower === '1' || lower === 'yes'
}

/** 直接查询 orders 表时：排除完成留档（含 status 为 null 的行，与 NOT 语义一致） */
export function ordersWhereRootExcludeArchived(): Prisma.ordersWhereInput {
  return { NOT: { status: ORDER_STATUS_ARCHIVED } }
}

/**
 * 关联查询里的 orders 条件（如 inbound_receipt.orders、inventory_lots.orders）。
 * 与现有 orders 条件合并为 AND，避免覆盖 NOT / OR。
 */
export function mergeOrdersRelationExcludeArchived(
  existing: Prisma.ordersWhereInput | undefined
): Prisma.ordersWhereInput {
  const fragment = ordersWhereRootExcludeArchived()
  if (!existing || Object.keys(existing).length === 0) {
    return fragment
  }
  return { AND: [fragment, existing] }
}

/**
 * inbound_receipt 列表：where 顶层可能是 orders，或 OR 数组内多条带 orders。
 */
export function applyArchivedFilterToInboundReceiptWhere(
  where: Record<string, unknown>,
  includeArchived: boolean
): void {
  if (includeArchived) return
  const fragment = ordersWhereRootExcludeArchived()
  const or = where.OR
  if (Array.isArray(or)) {
    where.OR = or.map((clause: unknown) => {
      const c = clause as { orders?: Prisma.ordersWhereInput }
      if (c?.orders) {
        return { ...c, orders: mergeOrdersRelationExcludeArchived(c.orders) }
      }
      return clause
    })
    return
  }
  if (where.orders) {
    where.orders = mergeOrdersRelationExcludeArchived(where.orders as Prisma.ordersWhereInput)
  } else {
    ;(where as { orders: Prisma.ordersWhereInput }).orders = fragment as Prisma.ordersWhereInput
  }
}

/**
 * inventory_lots 列表：无搜索时顶层 where.orders；有搜索时在 where.AND 上追加 orders 条件。
 */
export function applyArchivedFilterToInventoryLotsWhere(
  where: Record<string, unknown>,
  includeArchived: boolean
): void {
  if (includeArchived) return
  const nested: Prisma.ordersWhereInput = mergeOrdersRelationExcludeArchived(undefined)
  const ordersClause = { orders: nested }
  const and = where.AND
  if (Array.isArray(and)) {
    where.AND = [...and, ordersClause]
    return
  }
  if (where.orders) {
    where.orders = mergeOrdersRelationExcludeArchived(where.orders as Prisma.ordersWhereInput)
  } else {
    ;(where as { orders: Prisma.ordersWhereInput }).orders = nested
  }
}

/**
 * delivery_management：通过 delivery_appointments.orders 过滤归档订单。
 */
export function applyArchivedFilterToDeliveryManagementWhere(
  where: Record<string, unknown>,
  includeArchived: boolean
): void {
  if (includeArchived) return
  const extra = {
    delivery_appointments: {
      orders: ordersWhereRootExcludeArchived(),
    },
  }
  const existingAnd = where.AND
  if (Array.isArray(existingAnd)) {
    where.AND = [...existingAnd, extra]
  } else if (existingAnd) {
    where.AND = [existingAnd, extra]
  } else {
    where.AND = [extra]
  }
}
