/**
 * 订单批量导入权限（与 orders 配置 create 一致：操作部门 + 仓库部门）
 */
export const ORDER_IMPORT_ROLES = [
  'admin',
  'oms_manager',
  'oms_operator',
  'wms_operator',
] as const

export type OrderImportRole = (typeof ORDER_IMPORT_ROLES)[number]

export function canImportOrders(role: string | null | undefined): boolean {
  if (!role) return false
  return (ORDER_IMPORT_ROLES as readonly string[]).includes(role)
}
