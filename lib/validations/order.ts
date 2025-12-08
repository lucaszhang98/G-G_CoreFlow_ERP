/**
 * 订单验证 Schema
 */

import { z } from 'zod'

// 创建订单 Schema（只包含订单主表字段）
export const orderCreateSchema = z.object({
  order_number: z.string().min(1, '订单号不能为空').max(50, '订单号不能超过50个字符'),
  customer_id: z.number().optional().nullable(),
  user_id: z.number().optional().nullable(),
  order_date: z.string().or(z.date()),
  status: z.enum(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'archived']).optional(),
  operation_mode: z.enum(['unload', 'direct_delivery']).optional().nullable(),
  total_amount: z.number().min(0, '订单金额不能为负数'),
  discount_amount: z.number().min(0, '折扣金额不能为负数').optional().nullable(),
  tax_amount: z.number().min(0, '税费不能为负数').optional().nullable(),
  final_amount: z.number().min(0, '最终金额不能为负数'),
  notes: z.string().optional().nullable(),
  eta_date: z.string().or(z.date()).optional().nullable(),
  lfd_date: z.string().or(z.date()).optional().nullable(),
  pickup_date: z.string().or(z.date()).optional().nullable(),
  ready_date: z.string().or(z.date()).optional().nullable(),
  return_deadline: z.string().or(z.date()).optional().nullable(),
  container_type: z.string().max(50).optional().nullable(),
  container_volume: z.number().min(0).optional().nullable(), // 计算字段，由系统自动计算，用户不能填写
  mbl_number: z.string().max(100).optional().nullable(),
  do_issued: z.boolean().optional().nullable(),
  warehouse_account: z.string().max(100).optional().nullable(),
  pickup_driver_id: z.number().optional().nullable(),
  return_driver_id: z.number().optional().nullable(),
})

// 更新订单 Schema
export const orderUpdateSchema = orderCreateSchema.partial().extend({
  order_number: z.string().min(1, '订单号不能为空').max(50, '订单号不能超过50个字符').optional(),
})


