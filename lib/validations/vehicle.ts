import { z } from 'zod';

export const vehicleCreateSchema = z.object({
  vehicle_code: z.string()
    .max(50, '车辆代码长度不能超过 50')
    .optional(),
  plate_number: z.string()
    .max(50, '车牌号长度不能超过 50')
    .optional(),
  vehicle_type: z.string()
    .max(50, '车辆类型长度不能超过 50')
    .optional(),
  vin: z.string()
    .max(100, 'VIN长度不能超过 100')
    .optional(),
  capacity_weight: z.number()
    .min(0, '载重不能为负数')
    .optional(),
  capacity_volume: z.number()
    .min(0, '容量不能为负数')
    .optional(),
  status: z.string()
    .max(50, '状态长度不能超过 50')
    .default('active'),
  carrier_id: z.number()
    .int()
    .positive()
    .optional(),
  notes: z.string().optional()
});

export const vehicleUpdateSchema = vehicleCreateSchema.partial();

export type VehicleCreateInput = z.infer<typeof vehicleCreateSchema>;
export type VehicleUpdateInput = z.infer<typeof vehicleUpdateSchema>;

