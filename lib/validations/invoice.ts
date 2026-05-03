/**
 * 发票 / 账单验证 Schema
 * 注意：Zod 4 中不可对「已含 superRefine 的 schema」再 .partial()，故 create/update 共用裸 object 再分别 refine。
 */

import { z } from 'zod'

const invoiceFieldsSchema = z.object({
  invoice_type: z.enum(['direct_delivery', 'unload', 'penalty', 'storage'], {
    message: '请选择账单类型',
  }),
  invoice_number: z.string().min(1, '发票号不能为空').max(50),
  customer_id: z.number().int().positive('请选择客户'),
  order_id: z.number().int().positive().optional(),
  total_amount: z.number(),
  tax_amount: z.number().optional().default(0),
  currency: z.string().max(10).optional().default('USD'),
  invoice_date: z.string().min(1, '请选择发票日期'),
  status: z.enum(['draft', 'audited', 'issued', 'void']).optional().default('draft'),
  notes: z.string().optional(),
})

const invoiceFieldsSchemaPartial = invoiceFieldsSchema.partial()

const invoiceFieldsSchemaPartialOmitTotal = invoiceFieldsSchemaPartial.omit({
  total_amount: true,
})

function refineInvoiceCreate(
  data: z.infer<typeof invoiceFieldsSchema>,
  ctx: z.RefinementCtx
) {
  if (data.tax_amount < 0) {
    ctx.addIssue({
      code: 'custom',
      message: '税额不能为负',
      path: ['tax_amount'],
    })
  }
  if (data.invoice_type !== 'penalty' && data.total_amount < 0) {
    ctx.addIssue({
      code: 'custom',
      message: '金额不能为负',
      path: ['total_amount'],
    })
  }
}

function refineInvoiceUpdate(
  data: z.infer<typeof invoiceFieldsSchemaPartialOmitTotal>,
  ctx: z.RefinementCtx
) {
  if (data.tax_amount !== undefined && data.tax_amount < 0) {
    ctx.addIssue({
      code: 'custom',
      message: '税额不能为负',
      path: ['tax_amount'],
    })
  }
}

export const invoiceCreateSchema = invoiceFieldsSchema.superRefine(refineInvoiceCreate)

/** 更新不允许改总金额（仅由明细 recalc） */
export const invoiceUpdateSchema =
  invoiceFieldsSchemaPartialOmitTotal.superRefine(refineInvoiceUpdate)

export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>
export type InvoiceUpdateInput = z.infer<typeof invoiceUpdateSchema>
