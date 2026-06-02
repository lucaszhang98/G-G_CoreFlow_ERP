/** 展示用：订单关联上的 FIST（读 orders.fist，非 customers.fist） */
export function resolveOrderFistFromRelation(
  order: { fist?: boolean | null } | null | undefined
): boolean {
  return order?.fist === true
}

/** 出库预约：主单 order_id 或明细关联订单任一为 true 则 true */
export function resolveAppointmentFist(appointment: {
  orders?: { fist?: boolean | null } | null
  appointment_detail_lines?: Array<{
    order_detail?: { orders?: { fist?: boolean | null } | null } | null
  }> | null
}): boolean {
  if (resolveOrderFistFromRelation(appointment.orders)) return true
  for (const line of appointment.appointment_detail_lines ?? []) {
    if (resolveOrderFistFromRelation(line.order_detail?.orders)) return true
  }
  return false
}
