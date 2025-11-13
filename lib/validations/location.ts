import { z } from 'zod';

export const locationCreateSchema = z.object({
  location_code: z.string()
    .min(1, '位置代码不能为空')
    .max(50, '位置代码长度不能超过 50')
    .optional(),
  name: z.string()
    .min(1, '位置名称不能为空')
    .max(200, '位置名称长度不能超过 200'),
  location_type: z.string()
    .min(1, '位置类型不能为空')
    .max(50, '位置类型长度不能超过 50'),
  address_line1: z.string().max(200).optional(),
  address_line2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  postal_code: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
  timezone: z.string().max(100).optional(),
  latitude: z.number()
    .min(-90, '纬度必须在 -90 到 90 之间')
    .max(90, '纬度必须在 -90 到 90 之间')
    .optional(),
  longitude: z.number()
    .min(-180, '经度必须在 -180 到 180 之间')
    .max(180, '经度必须在 -180 到 180 之间')
    .optional(),
  notes: z.string().optional()
});

export const locationUpdateSchema = locationCreateSchema.partial();

export type LocationCreateInput = z.infer<typeof locationCreateSchema>;
export type LocationUpdateInput = z.infer<typeof locationUpdateSchema>;

