/**
 * 出库管理 PUT / 批量更新共用的写库逻辑（按 appointment_id）
 * 成功返回 undefined；失败返回 { error, status }
 */

import prisma from '@/lib/prisma'
import { addSystemFields, serializeBigInt } from '@/lib/api/helpers'
import {
  DELIVERY_APPOINTMENT_ACCOUNT_VALUE_SET,
  DELIVERY_APPOINTMENT_TYPE_VALUE_SET,
} from '@/lib/crud/delivery-appointment-shared-selects'

export type ApplyOutboundShipmentError = { error: string; status: number }

export async function applyOutboundShipmentRequestBody(
  appointmentId: string,
  body: Record<string, any>,
  user: Parameters<typeof addSystemFields>[1]
): Promise<ApplyOutboundShipmentError | undefined> {
  const updateData: any = {}

  if (body.trailer_code !== undefined) {
    updateData.trailer_code = body.trailer_code === '' || body.trailer_code === null ? null : body.trailer_code
  }
  if (body.loaded_by !== undefined || body.loaded_by_name !== undefined) {
    const loadedById = body.loaded_by || body.loaded_by_name
    if (loadedById) {
      if (typeof loadedById === 'string' && loadedById.trim() !== '') {
        try {
          updateData.loaded_by = BigInt(loadedById.trim())
        } catch {
          updateData.loaded_by = null
        }
      } else if (typeof loadedById === 'number' || typeof loadedById === 'bigint') {
        updateData.loaded_by = BigInt(loadedById)
      } else {
        updateData.loaded_by = null
      }
    } else {
      updateData.loaded_by = null
    }
  }
  if (body.notes !== undefined) {
    updateData.notes = body.notes === '' || body.notes === null ? null : body.notes
  }
  if (body.delivery_address !== undefined) {
    updateData.delivery_address = body.delivery_address === '' || body.delivery_address === null ? null : body.delivery_address
  }
  if (body.contact_name !== undefined) {
    updateData.contact_name = body.contact_name === '' || body.contact_name === null ? null : body.contact_name
  }
  if (body.contact_phone !== undefined) {
    updateData.contact_phone = body.contact_phone === '' || body.contact_phone === null ? null : body.contact_phone
  }

  const appointmentUpdateData: any = {}
  if (body.rejected !== undefined) {
    appointmentUpdateData.rejected = Boolean(body.rejected)
  }
  if (body.verify_loading_sheet !== undefined) {
    appointmentUpdateData.verify_loading_sheet = Boolean(body.verify_loading_sheet)
  }
  if (body.has_created_sheet !== undefined) {
    appointmentUpdateData.has_created_sheet = Boolean(body.has_created_sheet)
  }
  if (body.appointment_account !== undefined) {
    if (body.appointment_account === '' || body.appointment_account === null) {
      appointmentUpdateData.appointment_account = null
    } else {
      const v = String(body.appointment_account)
      if (!DELIVERY_APPOINTMENT_ACCOUNT_VALUE_SET.has(v)) {
        return { error: '预约账号必须从固定选项中选择', status: 400 }
      }
      appointmentUpdateData.appointment_account = v
    }
  }
  if (body.appointment_type !== undefined) {
    if (body.appointment_type === '' || body.appointment_type === null) {
      appointmentUpdateData.appointment_type = null
    } else {
      const v = String(body.appointment_type)
      if (!DELIVERY_APPOINTMENT_TYPE_VALUE_SET.has(v)) {
        return { error: '预约类型必须从固定选项中选择（地板或卡板）', status: 400 }
      }
      appointmentUpdateData.appointment_type = v
    }
  }
  if (body.confirmed_start !== undefined) {
    if (body.confirmed_start === '' || body.confirmed_start === null) {
      appointmentUpdateData.confirmed_start = null
    } else {
      const d = new Date(body.confirmed_start)
      if (Number.isNaN(d.getTime())) {
        return { error: '送货时间格式无效', status: 400 }
      }
      appointmentUpdateData.confirmed_start = d
    }
  }

  const appointment = await prisma.delivery_appointments.findUnique({
    where: { appointment_id: BigInt(appointmentId) },
    include: {
      orders: {
        select: { status: true },
      },
    },
  })

  if (!appointment) {
    return { error: '预约记录不存在', status: 404 }
  }

  if (appointment.orders?.status === 'direct_delivery') {
    return { error: '直送订单不在出库管理范围内', status: 400 }
  }

  let outboundShipment = await prisma.outbound_shipments.findUnique({
    where: { appointment_id: BigInt(appointmentId) },
    select: {
      appointment_id: true,
      trailer_code: true,
      outbound_shipment_id: true,
      warehouse_id: true,
      loaded_by: true,
      notes: true,
      delivery_address: true,
      contact_name: true,
      contact_phone: true,
    },
  })

  const oldTrailerCode = (outboundShipment as any)?.trailer_code

  if (!outboundShipment) {
    const defaultWarehouseId = BigInt(1)
    const createData: any = {
      appointment_id: BigInt(appointmentId),
      warehouse_id: defaultWarehouseId,
      trailer_code: updateData.trailer_code || null,
      loaded_by: updateData.loaded_by || null,
      notes: updateData.notes || null,
      delivery_address: updateData.delivery_address ?? null,
      contact_name: updateData.contact_name ?? null,
      contact_phone: updateData.contact_phone ?? null,
    }
    const finalCreateData = await addSystemFields(createData, user, true)
    outboundShipment = await prisma.outbound_shipments.create({
      data: finalCreateData as any,
      include: {
        users_outbound_shipments_loaded_byTousers: {
          select: { id: true, username: true },
        },
      },
    })
  } else {
    console.log(`[OutboundShipments] 更新前 updateData:`, JSON.stringify(serializeBigInt(updateData), null, 2))
    const finalUpdateData = await addSystemFields(updateData, user, false)
    console.log(`[OutboundShipments] 更新前 finalUpdateData:`, JSON.stringify(serializeBigInt(finalUpdateData), null, 2))

    await prisma.$transaction(async (tx) => {
      console.log(`[OutboundShipments] 执行数据库更新，data:`, JSON.stringify(serializeBigInt(finalUpdateData), null, 2))
      return tx.outbound_shipments.update({
        where: { appointment_id: BigInt(appointmentId) },
        data: finalUpdateData as any,
        include: {
          users_outbound_shipments_loaded_byTousers: {
            select: { id: true, username: true },
          },
        },
      })
    })

    if (body.trailer_code !== undefined) {
      const refreshedOutboundShipment = await prisma.outbound_shipments.findUnique({
        where: { appointment_id: BigInt(appointmentId) },
        select: { trailer_code: true } as any,
      })
      const newTrailerCode = (refreshedOutboundShipment as any)?.trailer_code || body.trailer_code || null
      if (newTrailerCode && newTrailerCode !== oldTrailerCode) {
        try {
          const deliveryManagement = await prisma.delivery_management.findUnique({
            where: { appointment_id: BigInt(appointmentId) },
          })
          if (deliveryManagement) {
            const appointmentForUpdate = await prisma.delivery_appointments.findUnique({
              where: { appointment_id: BigInt(appointmentId) },
              select: { delivery_method: true },
            })
            if (appointmentForUpdate?.delivery_method === '卡派' || appointmentForUpdate?.delivery_method === '自提') {
              await prisma.delivery_management.update({
                where: { delivery_id: deliveryManagement.delivery_id },
                data: { container_number: newTrailerCode } as any,
              })
            }
          }
        } catch (e) {
          console.error('[OutboundShipments] 自动更新送仓管理柜号失败:', e)
        }
      } else if (!newTrailerCode && oldTrailerCode) {
        try {
          const deliveryManagement = await prisma.delivery_management.findUnique({
            where: { appointment_id: BigInt(appointmentId) },
          })
          if (deliveryManagement) {
            const appointmentForUpdate = await prisma.delivery_appointments.findUnique({
              where: { appointment_id: BigInt(appointmentId) },
              select: { delivery_method: true },
            })
            if (appointmentForUpdate?.delivery_method === '卡派' || appointmentForUpdate?.delivery_method === '自提') {
              await prisma.delivery_management.update({
                where: { delivery_id: deliveryManagement.delivery_id },
                data: { container_number: null } as any,
              })
            }
          }
        } catch (e) {
          console.error('[OutboundShipments] 清空送仓管理柜号失败:', e)
        }
      }
    }
  }

  if (Object.keys(appointmentUpdateData).length > 0) {
    await prisma.delivery_appointments.update({
      where: { appointment_id: BigInt(appointmentId) },
      data: appointmentUpdateData,
    })
  }

  return undefined
}
