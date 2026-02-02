import { z } from 'zod'

export const paymentCreateSchema = z.object({
  customer_id: z.number().int().positive('请选择客户'),
  payment_date: z.string().min(1, '请选择收款日期'),
  amount: z.number().min(0, '金额不能为负'),
  currency: z.string().max(10).optional().default('USD'),
  payment_method: z.string().max(50).optional(),
  bank_reference: z.string().max(100).optional(),
  notes: z.string().optional(),
})

export const paymentUpdateSchema = paymentCreateSchema.partial()

export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>
export type PaymentUpdateInput = z.infer<typeof paymentUpdateSchema>
