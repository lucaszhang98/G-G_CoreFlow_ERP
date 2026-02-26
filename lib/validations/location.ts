import { z } from 'zod';

// 可选字段使用 nullish()，便于编辑时接口返回的 null 能通过校验
export const locationCreateSchema = z.object({
  location_code: z.string()
    .min(1, '位置代码不能为空')
    .max(50, '位置代码长度不能超过 50')
    .regex(/^[a-zA-Z0-9\-_\.\s]+$/, '位置代码只能包含英文字母、数字和符号（-、_、.、空格），不允许中文'),
  name: z.string()
    .min(1, '位置名称不能为空')
    .max(200, '位置名称长度不能超过 200'),
  location_type: z.string()
    .min(1, '位置类型不能为空')
    .max(50, '位置类型长度不能超过 50'),
  address_line1: z.string().max(200).nullish(),
  address_line2: z.string().max(200).nullish(),
  city: z.string().max(100).nullish(),
  state: z.string().max(100).nullish(),
  postal_code: z.string().max(20).nullish(),
  country: z.string().max(100).nullish(),
  timezone: z.string().max(100).nullish(),
  latitude: z
    .number()
    .min(-90, '纬度必须在 -90 到 90 之间')
    .max(90, '纬度必须在 -90 到 90 之间')
    .nullish(),
  longitude: z
    .number()
    .min(-180, '经度必须在 -180 到 180 之间')
    .max(180, '经度必须在 -180 到 180 之间')
    .nullish(),
  notes: z.string().nullish(),
});

export const locationUpdateSchema = locationCreateSchema.partial();

export type LocationCreateInput = z.infer<typeof locationCreateSchema>;
export type LocationUpdateInput = z.infer<typeof locationUpdateSchema>;

