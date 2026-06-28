import prisma from '@/lib/prisma'
import { resolveCurrentWarehouseId } from '@/lib/warehouse/current-warehouse'
import {
  carrierCodeFromRelation,
  normalizeCarrierCodeInput,
  type PickupCarrierCode,
} from '@/lib/utils/carrier-code-display'

export type ResolveCarrierCodeResult = {
  carrierId: bigint | null
  code: PickupCarrierCode | null
  error?: string
}

/** 根据用户输入解析承运公司 ID（空输入清空） */
export async function resolveCarrierIdFromInput(
  input: string | null | undefined,
  warehouseId?: bigint | null
): Promise<ResolveCarrierCodeResult> {
  if (input == null || String(input).trim() === '') {
    return { carrierId: null, code: null }
  }

  const code = normalizeCarrierCodeInput(input)
  if (!code) {
    return {
      carrierId: null,
      code: null,
      error: '承运公司只能是 CVT、NST 或 GG（也支持 G&G）',
    }
  }

  const scopedWarehouseId =
    warehouseId === undefined ? await resolveCurrentWarehouseId() : warehouseId

  const carriers = await prisma.carriers.findMany({
    where: {
      ...(scopedWarehouseId == null ? {} : { warehouse_id: scopedWarehouseId }),
      OR: [
        { carrier_code: { equals: code, mode: 'insensitive' } },
        { name: { equals: code, mode: 'insensitive' } },
        ...(code === 'GG'
          ? [{ name: { equals: 'G&G', mode: 'insensitive' as const } }]
          : []),
      ],
    },
    select: { carrier_id: true, carrier_code: true, name: true },
    take: 5,
  })

  const matched =
    carriers.find((c) => normalizeCarrierCodeInput(c.carrier_code) === code) ??
    carriers.find((c) => normalizeCarrierCodeInput(c.name) === code) ??
    carriers[0]

  if (!matched) {
    return {
      carrierId: null,
      code,
      error: `系统中未配置承运公司 ${code}，请先在承运商主数据中维护`,
    }
  }

  return {
    carrierId: matched.carrier_id,
    code: carrierCodeFromRelation(matched) ?? code,
  }
}

/** 列表/详情：从关联承运商取展示代码 */
export function pickupCarrierCodeField(
  carrier: { carrier_code?: string | null; name?: string | null } | null | undefined
): PickupCarrierCode | null {
  return carrierCodeFromRelation(carrier)
}
