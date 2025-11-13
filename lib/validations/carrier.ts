import { z } from 'zod';

export const carrierCreateSchema = z.object({
  carrier_code: z.string()
    .max(50, '承运商代码长度不能超过 50')
    .optional(),
  name: z.string()
    .min(1, '承运商名称不能为空')
    .max(200, '承运商名称长度不能超过 200'),
  carrier_type: z.string()
    .max(50, '承运商类型长度不能超过 50')
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
  }).optional()
});

export const carrierUpdateSchema = carrierCreateSchema.partial();

export type CarrierCreateInput = z.infer<typeof carrierCreateSchema>;
export type CarrierUpdateInput = z.infer<typeof carrierUpdateSchema>;

