/**
 * 提柜管理批量导入验证 Schema
 * 柜号必填，仅用于匹配已有订单（不新建任何数据）；其余可修改字段均为选填
 * 可修改字段：MBL，码头/查验站，码头位置，船司，柜型，承运公司，司机，ETA，LFD，提柜日期，还柜日期，现在位置
 */

import { z } from 'zod'

/** 可选字符串，空转 undefined */
const optionalStr = z
  .string()
  .transform((s) => (s === '' || s == null ? undefined : s.trim()))
  .optional()

/**
 * 单行导入数据 Schema（仅包含柜号 + 可修改字段，全部选填除柜号）
 */
export const pickupManagementImportRowSchema = z.object({
  container_number: z.string().min(1, '柜号不能为空').transform((s) => s.trim()),
  mbl: optionalStr,
  port_location_code: optionalStr,
  port_text: optionalStr,
  shipping_line: optionalStr,
  container_type: optionalStr,
  carrier_name: optionalStr,
  driver_code: optionalStr,
  eta_date: optionalStr,
  lfd_date: optionalStr,
  pickup_date: optionalStr,
  return_deadline: optionalStr,
  current_location: optionalStr,
})

export type PickupManagementImportRow = z.infer<typeof pickupManagementImportRowSchema>
