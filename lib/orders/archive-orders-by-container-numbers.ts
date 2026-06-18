import prisma from '@/lib/prisma'
import { normalizeContainerNumber } from '@/lib/mail-assistant/forecast-template-profile'
import {
  ORDER_STATUS_ARCHIVED,
  ORDER_STATUS_CANCELLED,
  ORDER_STATUS_CANCELED_US,
} from '@/lib/orders/order-visibility'

export type ArchivedOrderByContainer = {
  orderId: string
  orderNumber: string
}

/** 邮件助手重复导入前：将同柜号在营订单标为完成留档（已留档/已取消不动） */
export async function archiveActiveOrdersByContainerNumbers(
  containerNumbers: string[],
  userId: bigint
): Promise<{ archived: ArchivedOrderByContainer[] }> {
  const unique = [...new Set(containerNumbers.map(normalizeContainerNumber).filter(Boolean))]
  if (unique.length === 0) return { archived: [] }

  const candidates = await prisma.orders.findMany({
    where: {
      AND: [
        {
          OR: unique.map((cn) => ({
            order_number: { equals: cn, mode: 'insensitive' as const },
          })),
        },
        { NOT: { status: { equals: ORDER_STATUS_ARCHIVED, mode: 'insensitive' } } },
        { NOT: { status: { equals: ORDER_STATUS_CANCELLED, mode: 'insensitive' } } },
        { NOT: { status: { equals: ORDER_STATUS_CANCELED_US, mode: 'insensitive' } } },
      ],
    },
    select: { order_id: true, order_number: true },
  })

  if (candidates.length === 0) return { archived: [] }

  const archived: ArchivedOrderByContainer[] = []

  await prisma.$transaction(async (tx) => {
    for (const order of candidates) {
      await tx.orders.update({
        where: { order_id: order.order_id },
        data: {
          status: ORDER_STATUS_ARCHIVED,
          updated_by: userId,
          updated_at: new Date(),
        },
      })
      archived.push({
        orderId: order.order_id.toString(),
        orderNumber: order.order_number,
      })
    }
  })

  return { archived }
}
