import { z } from 'zod';

/** 部门外键：接受数字/数字字符串/关联对象，与列表行内编辑、RelationSelect 一致 */
function normalizeDepartmentIdInput(val: unknown): unknown {
  if (val === undefined) return undefined
  if (val === null || val === '' || val === '__all__') return null
  if (typeof val === 'object' && val !== null && 'id' in val) {
    const id = (val as { id: unknown }).id
    return id == null || id === '' ? null : String(id)
  }
  if (typeof val === 'bigint') return val.toString()
  if (typeof val === 'number' && Number.isFinite(val)) return String(Math.trunc(val))
  return String(val).trim()
}

const departmentIdSchema = z.preprocess(
  normalizeDepartmentIdInput,
  z.union([
    z.string().regex(/^\d+$/, '部门 ID 无效'),
    z.null(),
  ]).optional()
)

export const userCreateSchema = z.object({
  username: z.string()
    .min(3, '用户名至少 3 个字符')
    .max(50, '用户名长度不能超过 50'),
  password: z.string()
    .min(6, '密码至少 6 个字符')
    .max(100, '密码长度不能超过 100'),
  full_name: z.string()
    .max(100, '姓名长度不能超过 100')
    .optional(),
  department_id: departmentIdSchema,
  role: z.enum(['admin', 'oms_manager', 'tms_manager', 'wms_manager', 'wms_outbound_worker', 'wms_inbound_worker', 'oms_operator', 'wms_operator'])
    .default('wms_inbound_worker'),  // 默认力工
  status: z.enum(['active', 'inactive'])
    .default('active'),
  phone: z.string()
    .max(20, '电话长度不能超过 20')
    .optional(),
  avatar_url: z.string()
    .url('头像URL格式不正确')
    .optional()
});

export const userUpdateSchema = z.object({
  full_name: z.string().max(100).optional(),
  department_id: departmentIdSchema,
  role: z.enum(['admin', 'oms_manager', 'tms_manager', 'wms_manager', 'wms_outbound_worker', 'wms_inbound_worker', 'oms_operator', 'wms_operator']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  phone: z.string().max(20).optional(),
  avatar_url: z.string().url().optional()
});

export const resetPasswordSchema = z.object({
  new_password: z.string()
    .min(6, '密码至少 6 个字符')
    .max(100, '密码长度不能超过 100')
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
