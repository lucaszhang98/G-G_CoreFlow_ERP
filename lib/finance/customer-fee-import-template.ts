/**
 * 按客户生成费用批量导入/导出数据：默认模板 + 客户专属覆盖合并为完整费用表。
 */

import prisma from '@/lib/prisma'

export type CustomerFeeImportTemplateRow = {
  fee_id: string | null
  customer_code: string
  fee_code: string
  fee_name: string
  unit: string | null
  unit_price: number
  currency: string
  scope_type: 'customers'
  container_type: string | null
  description: string | null
}

function normCt(ct: string | null | undefined): string {
  if (ct == null) return ''
  return String(ct).trim()
}

function legacyKey(feeCode: string, ct: string | null | undefined): string {
  return `${feeCode.trim()}\x1f${normCt(ct)}`
}

export async function buildCustomerFeeImportRows(customerId: bigint): Promise<{
  customer: { id: bigint; code: string; name: string }
  rows: CustomerFeeImportTemplateRow[]
}> {
  const customer = await prisma.customers.findUnique({
    where: { id: customerId },
    select: { id: true, code: true, name: true },
  })
  if (!customer?.code) {
    throw new Error('客户不存在或缺少客户代码')
  }

  const [templates, customerFees] = await Promise.all([
    prisma.fee.findMany({
      where: { scope_type: 'all', customer_id: null },
      orderBy: [
        { sort_order: 'asc' },
        { container_type: 'asc' },
        { fee_code: 'asc' },
        { id: 'asc' },
      ],
    }),
    prisma.fee.findMany({
      where: {
        OR: [
          { customer_id: customerId },
          {
            scope_type: 'customers',
            fee_scope: { some: { customer_id: customerId } },
          },
        ],
      },
      include: { fee_scope: { select: { customer_id: true } } },
      orderBy: [{ sort_order: 'asc' }, { fee_code: 'asc' }, { id: 'asc' }],
    }),
  ])

  const byCloneId = new Map<string, (typeof customerFees)[number]>()
  const byLegacy = new Map<string, (typeof customerFees)[number]>()
  const usedCustomerFeeIds = new Set<string>()

  for (const row of customerFees) {
    if (row.cloned_from_fee_id != null) {
      byCloneId.set(row.cloned_from_fee_id.toString(), row)
    }
    if (row.customer_id === customerId) {
      byLegacy.set(legacyKey(row.fee_code, row.container_type), row)
    }
  }

  const rows: CustomerFeeImportTemplateRow[] = []

  for (const t of templates) {
    const override =
      byCloneId.get(t.id.toString()) ??
      byLegacy.get(legacyKey(t.fee_code, t.container_type))
    const src = override ?? t
    if (override) usedCustomerFeeIds.add(override.id.toString())

    rows.push({
      fee_id: override ? override.id.toString() : null,
      customer_code: customer.code,
      fee_code: src.fee_code,
      fee_name: src.fee_name,
      unit: src.unit,
      unit_price: Number(src.unit_price),
      currency: src.currency ?? 'USD',
      scope_type: 'customers',
      container_type: src.container_type,
      description: src.description,
    })
  }

  for (const row of customerFees) {
    if (usedCustomerFeeIds.has(row.id.toString())) continue
    if (row.customer_id !== customerId) continue
    const isTemplateClone =
      row.cloned_from_fee_id != null &&
      templates.some((t) => t.id === row.cloned_from_fee_id)
    if (isTemplateClone) continue

    rows.push({
      fee_id: row.id.toString(),
      customer_code: customer.code,
      fee_code: row.fee_code,
      fee_name: row.fee_name,
      unit: row.unit,
      unit_price: Number(row.unit_price),
      currency: row.currency ?? 'USD',
      scope_type: 'customers',
      container_type: row.container_type,
      description: row.description,
    })
  }

  rows.sort((a, b) => {
    const c = a.fee_code.localeCompare(b.fee_code)
    if (c !== 0) return c
    return normCt(a.container_type).localeCompare(normCt(b.container_type))
  })

  return { customer, rows }
}
