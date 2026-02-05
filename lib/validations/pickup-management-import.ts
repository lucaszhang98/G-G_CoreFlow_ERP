/**
 * 提柜管理批量导入验证 Schema（双 Sheet）
 * Sheet1：柜号，MBL，码头/查验站，承运公司，ETA，LFD，提柜日期
 * Sheet2：柜号，提出，报空，还空，码头/查验站，码头位置，柜型，船司，提柜日期，LFD，MBL，司机，现在位置
 */

import { z } from 'zod'

const optionalStr = z
  .string()
  .transform((s) => (s === '' || s == null ? undefined : s.trim()))
  .optional()

/** 解析 是/否、1/0、Y/N、true/false 等为 boolean，空为 undefined */
function optionalBoolean() {
  return z
    .union([z.string(), z.number(), z.boolean()])
    .transform((v) => {
      if (v === '' || v === null || v === undefined) return undefined
      if (typeof v === 'boolean') return v
      if (typeof v === 'number') return v === 1
      const s = String(v).trim().toLowerCase()
      if (['是', 'true', 'y', 'yes', '1', '对'].includes(s) || s === '1') return true
      if (['否', 'false', 'n', 'no', '0', '错'].includes(s) || s === '0') return false
      return undefined
    })
    .optional()
}

/** Sheet1 单行：柜号，MBL，码头/查验站，承运公司，ETA，LFD，提柜日期 */
export const pickupManagementSheet1RowSchema = z.object({
  container_number: z.string().min(1, '柜号不能为空').transform((s) => s.trim()),
  mbl: optionalStr,
  port_location_code: optionalStr,
  carrier_name: optionalStr,
  eta_date: optionalStr,
  lfd_date: optionalStr,
  pickup_date: optionalStr,
})

/** Sheet2 单行：柜号，提出，报空，还空，码头/查验站，码头位置，柜型，船司，提柜日期，LFD，MBL，司机，现在位置 */
export const pickupManagementSheet2RowSchema = z.object({
  container_number: z.string().min(1, '柜号不能为空').transform((s) => s.trim()),
  pickup_out: optionalBoolean(),
  report_empty: optionalBoolean(),
  return_empty: optionalBoolean(),
  port_location_code: optionalStr,
  port_text: optionalStr,
  container_type: optionalStr,
  shipping_line: optionalStr,
  pickup_date: optionalStr,
  lfd_date: optionalStr,
  mbl: optionalStr,
  driver_code: optionalStr,
  current_location: optionalStr,
})

export type PickupManagementSheet1Row = z.infer<typeof pickupManagementSheet1RowSchema>
export type PickupManagementSheet2Row = z.infer<typeof pickupManagementSheet2RowSchema>

/** 合并后的单条记录（按柜号合并 Sheet1 + Sheet2，Sheet2 覆盖重叠字段） */
export interface PickupManagementMergedRow {
  container_number: string
  mbl?: string
  port_location_code?: string
  carrier_name?: string
  eta_date?: string
  lfd_date?: string
  pickup_date?: string
  pickup_out?: boolean
  report_empty?: boolean
  return_empty?: boolean
  port_text?: string
  container_type?: string
  shipping_line?: string
  driver_code?: string
  current_location?: string
}
