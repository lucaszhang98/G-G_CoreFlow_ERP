import { z } from 'zod';

export const trailerCreateSchema = z.object({
  trailer_code: z.string()
    .max(50, '货柜代码长度不能超过 50')
    .optional(),
  trailer_type: z.string()
    .max(50, '货柜类型长度不能超过 50')
    .optional(),
  length_feet: z.number()
    .min(0, '长度不能为负数')
    .max(100, '长度不能超过 100 英尺')
    .optional(),
  capacity_weight: z.number()
    .min(0, '载重不能为负数')
    .optional(),
  capacity_volume: z.number()
    .min(0, '容量不能为负数')
    .optional(),
  status: z.string()
    .max(50, '状态长度不能超过 50')
    .default('available'),
  department_id: z.number()
    .int()
    .positive()
    .optional(),
  notes: z.string().optional()
});

export const trailerUpdateSchema = trailerCreateSchema.partial();

export type TrailerCreateInput = z.infer<typeof trailerCreateSchema>;
export type TrailerUpdateInput = z.infer<typeof trailerUpdateSchema>;

