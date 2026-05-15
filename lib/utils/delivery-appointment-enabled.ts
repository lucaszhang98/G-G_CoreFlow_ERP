/**
 * 预约「启用」语义：enabled 为 null 或 true 视为仍有效；仅显式 false 为停用（软删除）。
 */

export function isDeliveryAppointmentEnabled(enabled: boolean | null | undefined): boolean {
  return enabled !== false
}

/** Prisma 片段：仅统计 / 列出仍启用的预约 */
export const prismaDeliveryAppointmentNotDisabled = { NOT: { enabled: false } } as const

/**
 * 嵌套查询 appointment_detail_lines 时用：只返回所属预约仍启用的明细。
 * 订单明细、预约列表/详情、预约明细 API 等统一使用该口径，与已停用（软删）预约上的行脱钩，避免界面「一边有、一边无」。
 */
export const prismaAppointmentDetailLinesWhereParentAppointmentActive = {
  delivery_appointments: { is: prismaDeliveryAppointmentNotDisabled },
} as const

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
