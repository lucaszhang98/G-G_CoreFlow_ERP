/**
 * 私仓信息编码：GNG + 年月日(YYYYMMDD) + 四位随机数，无分隔符。
 * 全表唯一；同日四位随机数不重复（由唯一索引保证）。
 */

import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'

const CODE_PREFIX = 'GNG'
const RANDOM_ATTEMPTS = 80

type Db = typeof prisma | Prisma.TransactionClient

/** 业务日（America/Los_Angeles）格式化为 YYYYMMDD */
export function formatPrivateWarehouseInfoDate(ref: Date): string {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ref)
  return ymd.replace(/-/g, '')
}

/**
 * 订单日期 orders.order_date（Prisma @db.Date，UTC 午夜）→ YYYYMMDD。
 * 与库中「订单日期」日历日一致，避免按 LA 解释 UTC 午夜导致差一天。
 */
export function formatPrivateWarehouseInfoDateFromOrderDate(orderDate: Date): string {
  const y = orderDate.getUTCFullYear()
  const m = String(orderDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(orderDate.getUTCDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

export function randomFourDigitsPrivateWarehouse(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0')
}

export function buildPrivateWarehouseInfoCode(datePart: string, suffix: string): string {
  return `${CODE_PREFIX}${datePart}${suffix}`
}

export function isPrivateWarehouseDeliveryNature(
  deliveryNature: string | null | undefined
): boolean {
  return deliveryNature === '私仓'
}

/**
 * 生成唯一私仓信息；冲突时重试。
 */
export async function generateUniquePrivateWarehouseInfo(
  db: Db,
  refDate: Date = new Date()
): Promise<string> {
  const datePart = formatPrivateWarehouseInfoDate(refDate)

  for (let attempt = 0; attempt < RANDOM_ATTEMPTS; attempt++) {
    const code = buildPrivateWarehouseInfoCode(datePart, randomFourDigitsPrivateWarehouse())
    const existing = await db.order_detail.findFirst({
      where: { private_warehouse_info: code },
      select: { id: true },
    })
    if (!existing) return code
  }

  throw new Error('无法生成唯一私仓信息，请稍后重试')
}

/**
 * 创建订单明细时：仅私仓行生成编码，其余为 null。
 * refDate 应为创建时刻（手动/导入均传 new Date()），按 LA 业务日格式化为 YYYYMMDD。
 */
export async function resolvePrivateWarehouseInfoForCreate(
  db: Db,
  deliveryNature: string | null | undefined,
  refDate: Date = new Date()
): Promise<string | null> {
  if (!isPrivateWarehouseDeliveryNature(deliveryNature)) return null
  return generateUniquePrivateWarehouseInfo(db, refDate)
}
