import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { coerceExplicitBoolean } from '@/lib/crud/boolean-field'

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
 * 订单创建/更新：跟随客户 FIST，或在订单管理手改时打 fist_manual 标记。
 */
export async function applyOrderFistOnOrderWrite(
  processedData: Record<string, unknown>,
  ctx: {
    isCreate: boolean
    existing?: {
      customer_id: bigint | null
      fist?: boolean | null
      fist_manual?: boolean | null
    } | null
    /** 请求体是否显式包含 fist 字段 */
    fistExplicitlyInPayload: boolean
    client?: DbClient
  }
): Promise<void> {
  const client = ctx.client ?? prisma

  if (ctx.isCreate) {
    if (ctx.fistExplicitlyInPayload) {
      const explicit = coerceExplicitBoolean(processedData.fist)
      if (explicit !== undefined) {
        processedData.fist = explicit
        processedData.fist_manual = true
        return
      }
    }
    processedData.fist_manual = false
    const customerId = processedData.customer_id as bigint | null | undefined
    if (customerId == null) {
      processedData.fist = false
      return
    }
    processedData.fist = await fetchCustomerFist(customerId, client)
    return
  }

  const customerChanged =
    processedData.customer_id !== undefined &&
    (processedData.customer_id?.toString() ?? null) !==
      (ctx.existing?.customer_id?.toString() ?? null)

  if (customerChanged) {
    if (ctx.fistExplicitlyInPayload) {
      const explicit = coerceExplicitBoolean(processedData.fist)
      if (explicit !== undefined) {
        processedData.fist = explicit
        processedData.fist_manual = true
        return
      }
    }
    const newCustomerId = processedData.customer_id as bigint | null
    processedData.fist = await fetchCustomerFist(newCustomerId ?? undefined, client)
    processedData.fist_manual = false
    return
  }

  if (ctx.fistExplicitlyInPayload) {
    const explicit = coerceExplicitBoolean(processedData.fist)
    if (explicit !== undefined) {
      processedData.fist = explicit
      processedData.fist_manual = true
    }
  }
}

/** @deprecated 使用 applyOrderFistOnOrderWrite */
export async function applyOrderFistFromCustomerOnWrite(
  processedData: Record<string, unknown>,
  ctx: {
    isCreate: boolean
    existingCustomerId?: bigint | null
    client?: DbClient
  }
): Promise<void> {
  await applyOrderFistOnOrderWrite(processedData, {
    isCreate: ctx.isCreate,
    existing: ctx.existingCustomerId != null
      ? { customer_id: ctx.existingCustomerId }
      : null,
    fistExplicitlyInPayload: processedData.fist !== undefined,
    client: ctx.client,
  })
}

/**
 * 客户 FIST 变更后：同步该客户下未手改的订单。
 */
export async function syncOrdersFistAfterCustomerUpdate(
  customerId: bigint,
  newCustomerFist: boolean,
  client: DbClient = prisma
): Promise<number> {
  const result = await client.orders.updateMany({
    where: {
      customer_id: customerId,
      fist_manual: false,
    },
    data: { fist: newCustomerFist },
  })
  return result.count
}
