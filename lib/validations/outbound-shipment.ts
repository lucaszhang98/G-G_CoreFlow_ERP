import { z } from 'zod'

// 出库管理创建验证schema
export const outboundShipmentCreateSchema = z.object({
  warehouse_id: z.bigint().or(z.string().transform(val => BigInt(val))),
  shipment_number: z.string().max(100).optional().nullable(),
  scheduled_load_time: z.string().datetime().optional().nullable(),
  actual_load_time: z.string().datetime().optional().nullable(),
  status: z.string().max(50).optional().nullable(),
  total_pallets: z.number().int().optional().nullable(),
  total_volume: z.number().optional().nullable(),
  total_weight: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  destination_location_id: z.bigint().or(z.string().transform(val => BigInt(val))),
  trailer_id: z.bigint().or(z.string().transform(val => BigInt(val))).optional().nullable(),
  loaded_by: z.bigint().or(z.string().transform(val => BigInt(val))).optional().nullable(),
  bol_document_id: z.bigint().or(z.string().transform(val => BigInt(val))).optional().nullable(),
  load_sheet_document_id: z.bigint().or(z.string().transform(val => BigInt(val))).optional().nullable(),
  // 新增字段
  delivery_method: z.string().max(50).optional().nullable(),
  is_rejected: z.boolean().optional().nullable(),
  appointment_account: z.string().max(100).optional().nullable(),
  driver_id: z.bigint().or(z.string().transform(val => BigInt(val))).optional().nullable(),
  origin_location_id: z.bigint().or(z.string().transform(val => BigInt(val))).optional().nullable(),
})

// 出库管理更新验证schema
export const outboundShipmentUpdateSchema = outboundShipmentCreateSchema.partial()

