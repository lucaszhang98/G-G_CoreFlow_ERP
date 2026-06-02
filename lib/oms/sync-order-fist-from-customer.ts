import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'

type DbClient = Prisma.TransactionClient | typeof prisma

export async function fetchCustomerFist(
  customerId: bigint | null | undefined,
  client: DbClient = prisma
): Promise<boolean> {
  if (customerId == null) return false
  const row = await client.customers.findUnique({
    where: { id: customerId },
    select: { fist: true },
  })
  return row?.fist ?? false
}

/**
 * 订单写入时：未显式传 fist 则从客户带出；换客户时同步新客户 fist。
 */
export async function applyOrderFistFromCustomerOnWrite(
  processedData: Record<string, unknown>,
  ctx: {
    isCreate: boolean
    existingCustomerId?: bigint | null
    client?: DbClient
  }
): Promise<void> {
  if (processedData.fist !== undefined) return

  const client = ctx.client ?? prisma

  if (ctx.isCreate) {
    const customerId = processedData.customer_id as bigint | null | undefined
    if (customerId == null) {
      processedData.fist = false
      return
    }
    processedData.fist = await fetchCustomerFist(customerId, client)
    return
  }

  if (processedData.customer_id === undefined) return

  const newCustomerId = processedData.customer_id as bigint | null
  const prev = ctx.existingCustomerId ?? null
  if ((newCustomerId?.toString() ?? null) === (prev?.toString() ?? null)) {
    return
  }

  processedData.fist = await fetchCustomerFist(newCustomerId ?? undefined, client)
}
