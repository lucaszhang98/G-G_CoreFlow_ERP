import { z } from 'zod'

export const feeCreateSchema = z.object({
  fee_code: z.string().min(1, '费用编码不能为空').max(50),
  fee_name: z.string().min(1, '费用名称不能为空').max(100),
  unit: z.string().max(20).optional(),
  unit_price: z.number().min(0, '单价不能为负'),
  currency: z.string().max(10).optional().default('USD'),
  scope_type: z.enum(['all', 'customers']),
  container_type: z.string().max(50).optional().nullable(),
  description: z.string().optional(),
  is_active: z.boolean().optional().default(true),
})

export const feeUpdateSchema = feeCreateSchema.partial()

export type FeeCreateInput = z.infer<typeof feeCreateSchema>
export type FeeUpdateInput = z.infer<typeof feeUpdateSchema>
