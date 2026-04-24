/**
 * 预约「启用」语义：enabled 为 null 或 true 视为仍有效；仅显式 false 为停用（软删除）。
 */

export function isDeliveryAppointmentEnabled(enabled: boolean | null | undefined): boolean {
  return enabled !== false
}

/** Prisma 片段：仅统计 / 列出仍启用的预约 */
export const prismaDeliveryAppointmentNotDisabled = { NOT: { enabled: false } } as const

/**
 * 将 delivery_appointments 查询条件与「未停用」合并；保留顶层关联筛选（如 outbound_shipments）。
 */
export function withActiveDeliveryAppointmentsWhere(where: Record<string, any>): Record<string, any> {
  const guard = prismaDeliveryAppointmentNotDisabled
  const outbound = where.outbound_shipments
  const cleaned = { ...where }
  delete cleaned.outbound_shipments

  if (cleaned.AND && Array.isArray(cleaned.AND)) {
    const result: Record<string, any> = {
      ...cleaned,
      AND: [...cleaned.AND, guard],
    }
    if (outbound) result.outbound_shipments = outbound
    return result
  }

  const keys = Object.keys(cleaned).filter((k) => cleaned[k] !== undefined)
  const inner = keys.length > 0 ? cleaned : null
  const result: Record<string, any> = {
    AND: inner ? [guard, inner] : [guard],
  }
  if (outbound) result.outbound_shipments = outbound
  return result
}
