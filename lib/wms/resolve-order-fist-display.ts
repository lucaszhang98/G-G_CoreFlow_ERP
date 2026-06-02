/** 展示用：订单关联上的 FIST（读 orders.fist，非 customers.fist） */
export function resolveOrderFistFromRelation(
  order: { fist?: boolean | null } | null | undefined
): boolean {
  return order?.fist === true
}

/** 打印/列表：订单级 FIST 文案（中文） */
export function formatOrderFistDisplay(
  fist: boolean | null | undefined
): string {
  return fist === true ? '是' : '否'
}

/** BOL 打印：FIST 列英文 */
export function formatOrderFistDisplayEn(
  fist: boolean | null | undefined
): string {
  return fist === true ? 'Yes' : 'No'
}
