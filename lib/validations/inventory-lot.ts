import { z } from 'zod';

export const inventoryLotCreateSchema = z.object({
  order_id: z.string().min(1, '订单ID不能为空'),
  order_detail_id: z.string().min(1, '订单明细ID不能为空'),
  warehouse_id: z.string().min(1, '仓库ID不能为空'),
  inbound_receipt_id: z.string().optional().nullable(),
  storage_location_code: z.string().max(100, '位置代码不能超过100个字符').optional().nullable(),
  pallet_count: z.number().int().min(0, '实际板数不能为负数').default(1),
  remaining_pallet_count: z.number().int().min(0, '剩余板数不能为负数').optional().nullable().default(0),
  unbooked_pallet_count: z.number().int().min(0, '未约板数不能为负数').optional().nullable().default(0),
  delivery_progress: z.number().min(0).max(100).optional().nullable(),
  unload_transfer_notes: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(['available', 'allocated', 'shipped', 'reserved']).default('available'),
  lot_number: z.string().max(50, '批次号不能超过50个字符').optional().nullable(),
  received_date: z.string().optional().nullable(), // YYYY-MM-DD format
});

// 更新 schema：全部可选，且板数相关字段不加 default，避免只改仓库位置时被解析成 pallet_count:1 / remaining:0
export const inventoryLotUpdateSchema = z.object({
  order_id: z.string().min(1).optional(),
  order_detail_id: z.string().min(1).optional(),
  warehouse_id: z.string().min(1).optional(),
  inbound_receipt_id: z.string().optional().nullable(),
  storage_location_code: z.string().max(100).optional().nullable(),
  pallet_count: z.coerce.number().int().min(0, '实际板数不能为负数').optional(), // 允许 0，与入库管理详情页一致
  remaining_pallet_count: z.number().int().min(0).optional().nullable(),
  unbooked_pallet_count: z.number().int().min(0).optional().nullable(),
  delivery_progress: z.number().min(0).max(100).optional().nullable(),
  unload_transfer_notes: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(['available', 'allocated', 'shipped', 'reserved']).optional(),
  lot_number: z.string().max(50).optional().nullable(),
  received_date: z.string().optional().nullable(),
});

export type InventoryLotCreateInput = z.infer<typeof inventoryLotCreateSchema>;
export type InventoryLotUpdateInput = z.infer<typeof inventoryLotUpdateSchema>;

