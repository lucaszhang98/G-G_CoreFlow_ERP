import { z } from 'zod';

export const driverCreateSchema = z.object({
  driver_code: z.string()
    .max(50, '司机代码长度不能超过 50')
    .optional(),
  license_number: z.string()
    .max(100, '驾驶证号长度不能超过 100')
    .optional(),
  license_expiration: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必须是 YYYY-MM-DD')
    .optional(),
  status: z.string()
    .max(50, '状态长度不能超过 50')
    .default('active'),
  carrier_id: z.number()
    .int()
    .positive()
    .optional(),
  contact: z.object({
    name: z.string().min(1, '联系人姓名不能为空').max(100),
    phone: z.string().max(50).optional(),
    email: z.string().email('邮箱格式不正确').max(200).optional(),
    address_line1: z.string().max(200).optional(),
    address_line2: z.string().max(200).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    postal_code: z.string().max(20).optional(),
    country: z.string().max(100).optional()
  }).optional(),
  notes: z.string().optional()
});

export const driverUpdateSchema = driverCreateSchema.partial();

export type DriverCreateInput = z.infer<typeof driverCreateSchema>;
export type DriverUpdateInput = z.infer<typeof driverUpdateSchema>;

