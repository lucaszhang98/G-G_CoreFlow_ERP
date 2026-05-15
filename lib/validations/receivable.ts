import { z } from 'zod'

/** 新建应收：已核销/余额/状态仅由系统根据收款核销与发票同步计算，不可手填 */
export const receivableCreateSchema = z.object({
  invoice_id: z.number().int().positive('请选择发票'),
  customer_id: z.number().int().positive('请选择客户'),
  receivable_amount: z.number().min(0, '应收金额不能为负'),
  due_date: z.string().optional(),
  notes: z.string().optional(),
})

export const receivableUpdateSchema = receivableCreateSchema.partial()

export type ReceivableCreateInput = z.infer<typeof receivableCreateSchema>
export type ReceivableUpdateInput = z.infer<typeof receivableUpdateSchema>
