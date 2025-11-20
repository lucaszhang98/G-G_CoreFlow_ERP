import { z } from 'zod';

export const customerCreateSchema = z.object({
  code: z.string()
    .min(1, '客户代码不能为空')
    .max(50, '客户代码长度不能超过 50'),
  name: z.string()
    .min(1, '客户名称不能为空')
    .max(200, '客户名称长度不能超过 200'),
  company_name: z.string()
    .max(200, '公司名称长度不能超过 200')
    .optional(),
  credit_limit: z.number()
    .min(0, '信用额度不能为负数')
    .optional()
    .nullable(),  // 数据库可以为空，默认值为 0
  status: z.enum(['active', 'inactive'])
    .default('active'),
  contact: z.object({
    name: z.string().max(100).optional().nullable(),  // 联系人姓名可以为空（如果为空则不创建联系人）
    phone: z.string().max(50).optional().nullable(),
    email: z.string().max(200).optional().nullable().refine(
      (val) => !val || val === '' || z.string().email().safeParse(val).success,
      { message: '邮箱格式不正确' }
    ),  // 邮箱可以为空，但如果有值必须是有效邮箱
    address_line1: z.string().max(200).optional(),
    address_line2: z.string().max(200).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    postal_code: z.string().max(20).optional(),
    country: z.string().max(100).optional()
  }).optional()
});

export const customerUpdateSchema = customerCreateSchema.partial();

export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;

