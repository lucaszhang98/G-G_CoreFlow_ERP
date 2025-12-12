import { z } from 'zod'

export const deliveryAppointmentCreateSchema = z.object({
  reference_number: z.string().optional().nullable(),
  order_id: z.string().optional().nullable(),
  location_id: z.string().optional().nullable(),
  origin_location_id: z.string().optional().nullable(),
  appointment_type: z.string().optional().nullable(),
  delivery_method: z.string().optional().nullable(),
  appointment_account: z.string().optional().nullable(),
  requested_start: z.string().optional().nullable(),
  requested_end: z.string().optional().nullable(),
  confirmed_start: z.string().optional().nullable(),
  confirmed_end: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  rejected: z.boolean().optional().nullable(),
  po: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  total_pallets: z.number().optional().nullable(), // 添加 total_pallets 支持（虽然它是计算字段）
})

export const deliveryAppointmentUpdateSchema = deliveryAppointmentCreateSchema.partial()

