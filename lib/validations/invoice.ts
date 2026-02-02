import { z } from 'zod'

export const invoiceCreateSchema = z.object({
  invoice_number: z.string().min(1, '发票号不能为空').max(50),
  customer_id: z.number().int().positive('请选择客户'),
  order_id: z.number().int().positive().optional(),
  total_amount: z.number().min(0, '金额不能为负'),
  tax_amount: z.number().min(0).optional().default(0),
  currency: z.string().max(10).optional().default('USD'),
  invoice_date: z.string().min(1, '请选择发票日期'),
  status: z.enum(['draft', 'issued', 'void']).optional().default('draft'),
  notes: z.string().optional(),
})

export const invoiceUpdateSchema = invoiceCreateSchema.partial()

export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>
export type InvoiceUpdateInput = z.infer<typeof invoiceUpdateSchema>
