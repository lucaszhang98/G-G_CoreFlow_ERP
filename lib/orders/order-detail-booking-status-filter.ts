/**
 * 订单明细列表：按「预约状态」（未约/约满/超约）筛选。
 * 未约板数为计算字段，在完整 where 下先算出符合条件的 order_detail_id，再分页，避免抽样上限漏数据。
 */

import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { prismaAppointmentDetailLinesWhereParentAppointmentActive } from '@/lib/utils/delivery-appointment-enabled'
import {
  buildOrderDetailUnbookedCalcSelect,
  computeOrderDetailUnbookedPallets,
  matchesBookingStatusFilter,
} from '@/lib/orders/order-detail-unbooked-pallets'
import { intersectOrderDetailIdFilter } from '@/lib/orders/order-detail-earliest-appointment-filter'

export { intersectOrderDetailIdFilter }

type OrderDetailRowForBookingFilter = Prisma.order_detailGetPayload<{
  select: ReturnType<typeof buildOrderDetailUnbookedCalcSelect>
}>

/**
 * 在已构建的 order_detail where 下，找出未约板数符合预约状态筛选的明细 id。
 */
export async function findOrderDetailIdsByBookingStatus(
  orderDetailWhere: Prisma.order_detailWhereInput,
  filterValue: string
): Promise<bigint[]> {
  if (!filterValue || filterValue === '__all__') return []

  const select = buildOrderDetailUnbookedCalcSelect(
    prismaAppointmentDetailLinesWhereParentAppointmentActive
  )

  const rows: OrderDetailRowForBookingFilter[] = await prisma.order_detail.findMany({
    where: orderDetailWhere,
    select,
  })

  const ids: bigint[] = []
  for (const row of rows) {
    const unbooked = computeOrderDetailUnbookedPallets(row)
    if (matchesBookingStatusFilter(unbooked, filterValue)) {
      ids.push(row.id)
    }
  }
  return ids
}
