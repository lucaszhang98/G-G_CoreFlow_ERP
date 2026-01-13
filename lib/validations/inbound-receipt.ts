import { z } from 'zod';

export const inboundReceiptCreateSchema = z.object({
  order_id: z.number()
    .int()
    .positive('订单ID必须为正整数'),
  warehouse_id: z.number()
    .int()
    .positive('仓库ID必须为正整数'),
  status: z.enum(['pending', 'arrived', 'received'])
    .default('pending'),
  planned_unload_at: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '拆柜日期格式必须为 YYYY-MM-DD')
    .optional()
    .nullable(),
  unloaded_by: z.string()
    .optional()
    .nullable()
    .refine((val) => !val || /^\d+$/.test(val), {
      message: '拆柜人员ID必须是数字字符串',
    }),
  received_by: z.string()
    .optional()
    .nullable()
    .refine((val) => !val || /^\d+$/.test(val), {
      message: '入库人员ID必须是数字字符串',
    }),
  delivery_progress: z.number()
    .min(0, '送货进度不能小于0')
    .max(100, '送货进度不能大于100')
    .optional()
    .nullable(),
  notes: z.string()
    .max(1000, '备注长度不能超过 1000')
    .optional()
    .nullable(),
  unload_method_code: z.string()
    .max(50, '卸货方式代码长度不能超过 50')
    .optional()
    .nullable(),
});

// 更新 schema：所有字段都是可选的，但如果有值则必须符合规则
export const inboundReceiptUpdateSchema = z.object({
  order_id: z.number()
    .int()
    .positive('订单ID必须为正整数')
    .optional(),
  warehouse_id: z.number()
    .int()
    .positive('仓库ID必须为正整数')
    .optional(),
  status: z.enum(['pending', 'arrived', 'received'])
    .optional(),
  planned_unload_at: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '拆柜日期格式必须为 YYYY-MM-DD')
    .optional()
    .nullable(),
  unloaded_by: z.string()
    .optional()
    .nullable()
    .refine((val) => !val || /^\d+$/.test(val), {
      message: '拆柜人员ID必须是数字字符串',
    }),
  received_by: z.string()
    .optional()
    .nullable()
    .refine((val) => !val || /^\d+$/.test(val), {
      message: '入库人员ID必须是数字字符串',
    }),
  // delivery_progress 不在更新 schema 中，因为它是自动生成的
  notes: z.string()
    .max(1000, '备注长度不能超过 1000')
    .optional()
    .nullable(),
  unload_method_code: z.string()
    .max(50, '卸货方式代码长度不能超过 50')
    .optional()
    .nullable(),
});

export type InboundReceiptCreateInput = z.infer<typeof inboundReceiptCreateSchema>;
export type InboundReceiptUpdateInput = z.infer<typeof inboundReceiptUpdateSchema>;

