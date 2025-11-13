import { z } from 'zod';

export const userCreateSchema = z.object({
  username: z.string()
    .min(3, '用户名至少 3 个字符')
    .max(50, '用户名长度不能超过 50'),
  email: z.string()
    .email('邮箱格式不正确')
    .max(100, '邮箱长度不能超过 100'),
  password: z.string()
    .min(6, '密码至少 6 个字符')
    .max(100, '密码长度不能超过 100'),
  full_name: z.string()
    .max(100, '姓名长度不能超过 100')
    .optional(),
  department_id: z.number()
    .int('部门ID必须是整数')
    .positive('部门ID必须是正数')
    .optional(),
  role: z.enum(['admin', 'oms_manager', 'tms_manager', 'wms_manager', 'employee', 'user'])
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
  email: z.string().email().max(100).optional(),
  full_name: z.string().max(100).optional(),
  department_id: z.number().int().positive().optional(),
  role: z.enum(['admin', 'oms_manager', 'tms_manager', 'wms_manager', 'employee', 'user']).optional(),
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

