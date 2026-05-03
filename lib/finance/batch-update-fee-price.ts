/**
 * 费用批量调价：按客户范围 + 柜型 + 费用名称模糊匹配定位行，预览后统一改 unit_price。
 */

import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { feeMatchesContainer } from '@/lib/finance/fee-matching'

export type BatchFeePriceQueryParams = {
  allCustomers: boolean
  customerIds: bigint[]
  /** 留空：只匹配「不限柜型」的费用行（container_type 为空） */
  containerTypeInput: string | null | undefined
  /** 模糊：fee_name / fee_code contains（与 fee_code_exact 二选一） */
  feeNameSearch?: string
  /** 精确：fee_code equals（不区分大小写）；可选，与 feeNameSearch 二选一 */
  feeCodeExact?: string
}

/** 柜型筛选：未填=仅不限柜型；有值=按 feeMatchesContainer（含费用侧空柜型=通用） */
export function matchesContainerForBatchUpdate(
  feeContainer: string | null | undefined,
  userInput: string | null | undefined
): boolean {
  const u = userInput != null ? String(userInput).trim() : ''
  if (u === '') {
    const f = feeContainer != null ? String(feeContainer).trim() : ''
    return f === ''
  }
  return feeMatchesContainer(feeContainer, userInput)
}

function buildCustomerScopeWhere(
  allCustomers: boolean,
  customerIds: bigint[]
): Prisma.feeWhereInput | null {
  if (allCustomers) return null
  if (customerIds.length === 0) {
    throw new Error('未勾选「全部客户」时，请至少选择一个客户')
  }
  return {
    OR: [
      { customer_id: { in: customerIds } },
      { fee_scope: { some: { customer_id: { in: customerIds } } } },
    ],
  }
}

export async function queryFeesForBatchPriceUpdate(params: BatchFeePriceQueryParams) {
  const code = params.feeCodeExact?.trim()
  const search = (params.feeNameSearch ?? '').trim()

  if (!code && search.length === 0) {
    throw new Error('请选择费用（费用编码）或输入费用关键字')
  }

  const andClauses: Prisma.feeWhereInput[] = []

  if (code) {
    andClauses.push({
      fee_code: { equals: code, mode: 'insensitive' },
    })
  } else {
    andClauses.push({
      OR: [
        { fee_name: { contains: search, mode: 'insensitive' } },
        { fee_code: { contains: search, mode: 'insensitive' } },
      ],
    })
  }

  const scopeWhere = buildCustomerScopeWhere(
    params.allCustomers,
    params.customerIds
  )
  if (scopeWhere) {
    andClauses.push(scopeWhere)
  }

  const where: Prisma.feeWhereInput = { AND: andClauses }

  const rows = await prisma.fee.findMany({
    where,
    include: {
      customers: { select: { id: true, code: true, name: true } },
      fee_scope: { select: { customer_id: true } },
    },
    orderBy: [{ id: 'asc' }],
  })

  return rows.filter((r) =>
    matchesContainerForBatchUpdate(r.container_type, params.containerTypeInput)
  )
}

export async function applyBatchFeeUnitPrice(
  feeIds: bigint[],
  newUnitPrice: number,
  updatedBy: bigint | null
): Promise<number> {
  if (feeIds.length === 0) return 0
  const dec = new Prisma.Decimal(Number(newUnitPrice).toFixed(2))
  const now = new Date()
  const result = await prisma.fee.updateMany({
    where: { id: { in: feeIds } },
    data: {
      unit_price: dec,
      updated_at: now,
      updated_by: updatedBy ?? undefined,
    },
  })
  return result.count
}
