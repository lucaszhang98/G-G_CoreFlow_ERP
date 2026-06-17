/**
 * 费用批量导入 Service
 */

import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { BaseImportService } from './import/base-import.service'
import { ImportConfig, ImportError } from './import/types'
import { feeImportRowSchema, FeeImportRow } from '@/lib/validations/fee-import'

async function executeCustomerFeeImport(
  data: FeeImportRow[],
  userId: bigint
): Promise<{ successCount: number }> {
  const codes = [...new Set(data.map((r) => r.customer_code).filter(Boolean))]
  if (codes.length !== 1 || !codes[0]) {
    throw new Error('客户费用导入：所有行的客户代码必须一致且不能为空')
  }

  const customer = await prisma.customers.findFirst({
    where: { code: { equals: codes[0], mode: 'insensitive' } },
    select: { id: true, code: true },
  })
  if (!customer) {
    throw new Error(`未找到客户代码「${codes[0]}」`)
  }

  const feeRowKey = (feeCode: string, containerType: string | null) =>
    `${feeCode.trim().toLowerCase()}\x1f${containerType ?? ''}`

  const [existingFees, templates] = await Promise.all([
    prisma.fee.findMany({
      where: { customer_id: customer.id },
      select: { id: true, fee_code: true, container_type: true },
    }),
    prisma.fee.findMany({
      where: { scope_type: 'all', customer_id: null },
      select: { id: true, fee_code: true, container_type: true, sort_order: true },
    }),
  ])

  const existingById = new Map(existingFees.map((f) => [f.id.toString(), f]))
  const existingByCodeCt = new Map(
    existingFees.map((f) => [feeRowKey(f.fee_code, f.container_type), f])
  )
  const templateByCodeCt = new Map(
    templates.map((t) => [feeRowKey(t.fee_code, t.container_type), t])
  )

  let updated = 0
  let created = 0

  await prisma.$transaction(
    async (tx) => {
      for (const row of data) {
        if (row.scope_type !== 'customers') {
          throw new Error(
            `费用「${row.fee_code}」：客户费用表归属范围必须为 customers`
          )
        }

        const containerType = row.container_type ?? null
        let existing =
          (row.fee_id ? existingById.get(row.fee_id) : undefined) ??
          existingByCodeCt.get(feeRowKey(row.fee_code, containerType)) ??
          null

        const payload = {
          fee_code: row.fee_code,
          fee_name: row.fee_name,
          unit: row.unit ?? null,
          unit_price: new Prisma.Decimal(Number(row.unit_price).toFixed(2)),
          currency: row.currency ?? 'USD',
          scope_type: 'customers' as const,
          container_type: containerType,
          description: row.description ?? null,
          customer_id: customer.id,
          updated_by: userId,
          updated_at: new Date(),
        }

        if (existing) {
          await tx.fee.update({
            where: { id: existing.id },
            data: payload,
          })
          updated += 1
        } else {
          const template = templateByCodeCt.get(feeRowKey(row.fee_code, containerType))

          await tx.fee.create({
            data: {
              ...payload,
              sort_order: template?.sort_order ?? 0,
              cloned_from_fee_id: template?.id ?? null,
              created_by: userId,
            },
          })
          created += 1
        }
      }
    },
    { timeout: 120_000, maxWait: 30_000 }
  )

  return { successCount: updated + created }
}

const feeImportConfig: ImportConfig<FeeImportRow> = {
  headerMap: {
    客户代码: 'customer_code',
    费用ID: 'fee_id',
    费用编码: 'fee_code',
    费用名称: 'fee_name',
    单位: 'unit',
    单价: 'unit_price',
    币种: 'currency',
    归属范围: 'scope_type',
    柜型: 'container_type',
    说明: 'description',
  },

  validationSchema: feeImportRowSchema,

  requiredRoles: ['admin', 'oms_manager'],

  executeImport: async (data: FeeImportRow[], userId: bigint): Promise<{ successCount: number }> => {
    if (data.length === 0) return { successCount: 0 }

    const isCustomerImport = data.some((r) => r.customer_code)
    if (isCustomerImport) {
      return executeCustomerFeeImport(data, userId)
    }

    const mapRow = (row: FeeImportRow) => ({
      fee_code: row.fee_code,
      fee_name: row.fee_name,
      unit: row.unit ?? null,
      unit_price: row.unit_price,
      currency: row.currency ?? 'USD',
      scope_type: row.scope_type,
      container_type: row.container_type ?? null,
      description: row.description ?? null,
      created_by: userId,
      updated_by: userId,
    })

    const BATCH = 250
    const operations = []
    for (let i = 0; i < data.length; i += BATCH) {
      const slice = data.slice(i, i + BATCH).map(mapRow)
      operations.push(prisma.fee.createMany({ data: slice }))
    }

    if (operations.length === 1) {
      await operations[0]
    } else {
      await prisma.$transaction(operations)
    }

    return { successCount: data.length }
  },
}

export const feeImportService = new BaseImportService(feeImportConfig)
