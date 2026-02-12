/**
 * 出库管理详情：共享查询逻辑，供 API GET 与详情页使用
 */

import prisma from '@/lib/prisma'
import { serializeBigInt } from '@/lib/api/helpers'

export interface OutboundShipmentDetailPayload {
  appointment_id: string
  reference_number: string | null
  delivery_method: string | null
  rejected: boolean
  appointment_account: string | null
  appointment_type: string | null
  origin_location: string | null
  destination_location: string | null
  confirmed_start: string | null
  total_pallets: number
  outbound_shipment_id: string | null
  trailer_id: string | null
  trailer_code: string | null
  loaded_by: string | null
  loaded_by_name: string | null
  notes: string | null
  delivery_address: string | null
  contact_name: string | null
  contact_phone: string | null
  users_outbound_shipments_loaded_byTousers: { id: string; username: string; full_name?: string | null } | null
  // 主行完整信息（delivery_appointments）
  status: string | null
  requested_start: string | null
  requested_end: string | null
  confirmed_end: string | null
  po: string | null
  created_at: string | null
  updated_at: string | null
  order_number: string | null
}

/**
 * 根据 appointment_id 获取出库管理详情（与 API GET 返回结构一致）
 * 若记录不存在或为直送订单则返回 null
 */
export async function getOutboundShipmentDetail(
  appointmentId: string
): Promise<OutboundShipmentDetailPayload | null> {
  if (!appointmentId || isNaN(Number(appointmentId))) {
    return null
  }

  const appointment = await prisma.delivery_appointments.findUnique({
    where: { appointment_id: BigInt(appointmentId) },
    include: {
      orders: {
        select: {
          order_id: true,
          order_number: true,
          status: true,
          order_detail: {
            select: {
              id: true,
              estimated_pallets: true,
            },
          },
        },
      },
      locations: {
        select: {
          location_id: true,
          location_code: true,
        },
      },
      locations_delivery_appointments_origin_location_idTolocations: {
        select: {
          location_id: true,
          location_code: true,
        },
      },
      outbound_shipments: {
        select: {
          outbound_shipment_id: true,
          trailer_id: true,
          trailer_code: true,
          loaded_by: true,
          notes: true,
          delivery_address: true,
          contact_name: true,
          contact_phone: true,
          users_outbound_shipments_loaded_byTousers: {
            select: {
              id: true,
              username: true,
              full_name: true,
            },
          },
        },
      },
    },
  })

  if (!appointment) return null
  if (appointment.orders?.status === 'direct_delivery') return null

  const serialized = serializeBigInt(appointment)
  const outboundShipment = serialized.outbound_shipments || null

  let totalPallets = 0
  if (serialized.orders?.order_detail && Array.isArray(serialized.orders.order_detail)) {
    totalPallets = serialized.orders.order_detail.reduce((sum: number, detail: any) => {
      return sum + (detail.estimated_pallets || 0)
    }, 0)
  }

  return {
    appointment_id: serialized.appointment_id.toString(),
    reference_number: serialized.reference_number || null,
    delivery_method: serialized.delivery_method || null,
    rejected: serialized.rejected || false,
    appointment_account: serialized.appointment_account || null,
    appointment_type: serialized.appointment_type || null,
    origin_location: serialized.locations_delivery_appointments_origin_location_idTolocations?.location_code || null,
    destination_location: serialized.locations?.location_code || null,
    confirmed_start: serialized.confirmed_start || null,
    total_pallets: totalPallets,
    outbound_shipment_id: outboundShipment ? outboundShipment.outbound_shipment_id.toString() : null,
    trailer_id: outboundShipment?.trailer_id ? outboundShipment.trailer_id.toString() : null,
    trailer_code: outboundShipment?.trailer_code || null,
    loaded_by: outboundShipment?.loaded_by ? outboundShipment.loaded_by.toString() : null,
    loaded_by_name:
      outboundShipment?.users_outbound_shipments_loaded_byTousers?.full_name ||
      outboundShipment?.users_outbound_shipments_loaded_byTousers?.username ||
      null,
    notes: outboundShipment?.notes || null,
    delivery_address: outboundShipment?.delivery_address || null,
    contact_name: outboundShipment?.contact_name || null,
    contact_phone: outboundShipment?.contact_phone || null,
    users_outbound_shipments_loaded_byTousers: outboundShipment?.users_outbound_shipments_loaded_byTousers || null,
    status: serialized.status || null,
    requested_start: serialized.requested_start || null,
    requested_end: serialized.requested_end || null,
    confirmed_end: serialized.confirmed_end || null,
    po: serialized.po || null,
    created_at: serialized.created_at || null,
    updated_at: serialized.updated_at || null,
    order_number: serialized.orders?.order_number || null,
  }
}
