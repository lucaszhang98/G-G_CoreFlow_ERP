/** 展示用：订单关联上的 FIST（读 orders.fist，非 customers.fist） */
export function resolveOrderFistFromRelation(
  order: { fist?: boolean | null } | null | undefined
): boolean {
  return order?.fist === true
}

/** 打印/列表：订单级 FIST 文案 */
export function formatOrderFistDisplay(
  fist: boolean | null | undefined
): string {
  return fist === true ? '是' : '否'
}

/** 装车单/BOL 柜号列：FIST 订单加标记 */
export function formatContainerNumberWithFistMark(
  containerNumber: string | null | undefined,
  orderFist?: boolean | null
): string {
  const base = (containerNumber ?? '').trim() || '-'
  return orderFist === true ? `${base} [FIST]` : base
}
