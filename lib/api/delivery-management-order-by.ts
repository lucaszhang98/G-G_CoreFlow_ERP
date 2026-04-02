import type { Prisma } from '@prisma/client'

/**
 * 送仓管理列表 orderBy：预约时间 = COALESCE 语义近似（先 confirmed_start，再 requested_start，再 delivery_id 稳定序）
 */
export function buildDeliveryManagementOrderBy(
  sort: string,
  order: 'asc' | 'desc'
): Prisma.delivery_managementOrderByWithRelationInput | Prisma.delivery_managementOrderByWithRelationInput[] {
  const apptTime: Prisma.delivery_managementOrderByWithRelationInput[] = [
    { delivery_appointments: { confirmed_start: order } },
    { delivery_appointments: { requested_start: order } },
    { delivery_id: order },
  ]

  switch (sort) {
    case 'appointment_time':
    case 'delivery_date':
      return apptTime
    case 'created_at':
      return { created_at: order }
    case 'container_number':
      return { container_number: order }
    case 'status':
      return { status: order }
    case 'appointment_number':
      return { delivery_appointments: { reference_number: order } }
    case 'delivery_method':
      return { delivery_appointments: { delivery_method: order } }
    case 'warehouse_account':
      return { delivery_appointments: { appointment_account: order } }
    case 'pallet_type':
      return { delivery_appointments: { appointment_type: order } }
    case 'driver_name':
      return { driver_name: order }
    case 'rejected':
      return { delivery_appointments: { rejected: order } }
    case 'notes':
      return { notes: order }
    case 'po':
    default:
      return apptTime
  }
}
