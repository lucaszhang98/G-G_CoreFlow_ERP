import { z } from 'zod';

export const userCreateSchema = z.object({
  username: z.string()
    .min(3, '用户名至少 3 个字符')
    .max(50, '用户名长度不能超过 50')
    .regex(
      /^[a-zA-Z0-9_]+$/,
      '用户名只能包含字母、数字和下划线，不允许空格和特殊字符'
    ),
  name: z.string()
    .min(2, '姓名至少 2 个字符')
    .max(50, '姓名长度不能超过 50')
    .regex(
      /^[\u4e00-\u9fa5a-zA-Z\s]+$/,
      '姓名只能包含中文字符、英文字母和空格，不允许特殊字符'
    ),
  password: z.string()
    .min(6, '密码至少 6 个字符')
    .max(100, '密码长度不能超过 100'),
  department_id: z.number()
    .int('部门ID必须是整数')
    .positive('部门ID必须是正数')
    .optional(),
  role: z.enum(['admin', 'oms_manager', 'tms_manager', 'wms_manager', 'wms_supervisor', 'wms_inbound_worker', 'wms_outbound_worker', 'employee', 'user'])
    .default('employee'),  // 与数据库默认值保持一致
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
  username: z.string()
    .min(3, '用户名至少 3 个字符')
    .max(50, '用户名长度不能超过 50')
    .regex(
      /^[a-zA-Z0-9_]+$/,
      '用户名只能包含字母、数字和下划线，不允许空格和特殊字符'
    )
    .optional(),
  password: z.string()
    .min(6, '密码至少 6 个字符')
    .max(100, '密码长度不能超过 100')
    .optional(),
  name: z.string()
    .min(2, '姓名至少 2 个字符')
    .max(50, '姓名长度不能超过 50')
    .regex(
      /^[\u4e00-\u9fa5a-zA-Z\s]+$/,
      '姓名只能包含中文字符、英文字母和空格，不允许特殊字符'
    )
    .optional(),
  department_id: z.number().int().positive().optional(),
  role: z.enum(['admin', 'oms_manager', 'tms_manager', 'wms_manager', 'wms_supervisor', 'wms_inbound_worker', 'wms_outbound_worker', 'employee', 'user']).optional(),
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

