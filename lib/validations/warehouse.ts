import { z } from 'zod';

export const warehouseCreateSchema = z.object({
  warehouse_code: z.string()
    .min(1, '仓库代码不能为空')
    .max(50, '仓库代码长度不能超过 50'),
  name: z.string()
    .min(1, '仓库名称不能为空')
    .max(200, '仓库名称长度不能超过 200'),
  location_id: z.number()
    .int('位置ID必须是整数')
    .positive('位置ID必须是正数')
    .optional(),
  capacity_cbm: z.number()
    .min(0, '容量不能为负数')
    .optional(),
  operating_hours: z.record(z.string()).optional(), // JSON 对象
  contact_user_id: z.number()
    .int()
    .positive()
    .optional(),
  notes: z.string().optional()
});

export const warehouseUpdateSchema = warehouseCreateSchema.partial();

export type WarehouseCreateInput = z.infer<typeof warehouseCreateSchema>;
export type WarehouseUpdateInput = z.infer<typeof warehouseUpdateSchema>;

