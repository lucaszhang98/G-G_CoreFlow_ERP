import { z } from 'zod'

export const receivableCreateSchema = z.object({
  invoice_id: z.number().int().positive('请选择发票'),
  customer_id: z.number().int().positive('请选择客户'),
  receivable_amount: z.number().min(0, '应收金额不能为负'),
  allocated_amount: z.number().min(0).optional().default(0),
  balance: z.number().min(0).optional(),
  due_date: z.string().optional(),
  status: z.enum(['open', 'partial', 'closed']).optional().default('open'),
  notes: z.string().optional(),
})

export const receivableUpdateSchema = receivableCreateSchema.partial()

export type ReceivableCreateInput = z.infer<typeof receivableCreateSchema>
export type ReceivableUpdateInput = z.infer<typeof receivableUpdateSchema>
