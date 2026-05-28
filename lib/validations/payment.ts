import { z } from 'zod'

export const paymentCreateSchema = z.object({
  customer_id: z.number().int().positive('请选择客户'),
  payment_date: z.string().min(1, '请选择收款日期'),
  amount: z.number().min(0, '金额不能小于 0'),
  currency: z.string().max(10).optional().default('USD'),
  bank_reference: z.string().max(100).optional(),
  write_off: z.boolean().optional().default(false),
  notes: z.string().optional(),
})

export const paymentUpdateSchema = paymentCreateSchema.partial()

export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>
export type PaymentUpdateInput = z.infer<typeof paymentUpdateSchema>
