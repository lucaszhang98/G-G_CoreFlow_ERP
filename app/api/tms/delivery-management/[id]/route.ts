import { NextRequest, NextResponse } from 'next/server'
import { checkAuth, serializeBigInt, addSystemFields } from '@/lib/api/helpers'
import prisma from '@/lib/prisma'

// GET - 获取单个送仓管理记录
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    const resolvedParams = params instanceof Promise ? await params : params
    const deliveryId = resolvedParams.id

    const delivery = await prisma.delivery_management.findUnique({
      where: { delivery_id: BigInt(deliveryId) },
      include: {
        delivery_appointments: {
          select: {
            appointment_id: true,
            reference_number: true,
            order_id: true,
            location_id: true,
            origin_location_id: true,
            appointment_type: true,
            delivery_method: true,
            appointment_account: true,
            confirmed_start: true,
            requested_start: true,
            rejected: true,
            locations: {
              select: {
                location_id: true,
                name: true,
                location_code: true,
                location_type: true,
              },
            },
            locations_delivery_appointments_origin_location_idTolocations: {
              select: {
                location_id: true,
                name: true,
                location_code: true,
                location_type: true,
              },
            },
            orders: {
              select: {
                order_id: true,
                order_number: true,
                warehouse_account: true,
              },
            },
            appointment_detail_lines: {
              select: {
                order_detail_id: true,
                order_detail: {
                  select: {
                    po: true,
                  },
                },
              },
            },
          },
        },
        drivers: {
          select: {
            driver_id: true,
            driver_code: true,
            contact_roles: {
              select: {
                name: true,
                phone: true,
                email: true,
              },
            },
          },
        },
      },
    })

    if (!delivery) {
      return NextResponse.json({ error: '送仓管理记录不存在' }, { status: 404 })
    }

    const serialized = serializeBigInt(delivery)
    const appointment = serialized.delivery_appointments
    const order = appointment?.orders
    const driver = serialized.drivers

    // 聚合 PO
    const poList = appointment?.appointment_detail_lines
      ?.map((line: any) => line.order_detail?.po)
      .filter((po: any) => po) || []
    const po = poList.length > 0 ? poList.join(', ') : null

    // 送货日期
    const deliveryDate = appointment?.confirmed_start || appointment?.requested_start || null

    return NextResponse.json({
      delivery_id: String(serialized.delivery_id || ''),
      appointment_number: appointment?.reference_number || null,
      container_number: order?.order_number || null,
      delivery_date: deliveryDate,
      origin_location: appointment?.locations_delivery_appointments_origin_location_idTolocations?.location_code || null,
      origin_location_id: appointment?.origin_location_id ? String(appointment.origin_location_id) : null,
      destination_location: appointment?.locations?.location_code || null,
      destination_location_id: appointment?.location_id ? String(appointment.location_id) : null,
      po: po,
      pallet_type: appointment?.appointment_type || null,
      delivery_method: appointment?.delivery_method || null,
      warehouse_account: order?.warehouse_account || null,
      appointment_time: deliveryDate,
      driver_name: driver?.contact_roles?.name || null,
      driver_id: serialized.driver_id ? String(serialized.driver_id) : null,
      rejected: appointment?.rejected || false,
      status: serialized.status || null,
      notes: serialized.notes || null,
      appointment_id: appointment ? String(appointment.appointment_id || '') : null,
      created_at: serialized.created_at || null,
      updated_at: serialized.updated_at || null,
    })
  } catch (error: any) {
    console.error('获取送仓管理记录失败:', error)
    return NextResponse.json(
      { error: error.message || '获取送仓管理记录失败' },
      { status: 500 }
    )
  }
}

// 更新送仓管理记录的共享逻辑
async function updateDeliveryManagement(
  request: NextRequest,
  params: Promise<{ id: string }> | { id: string }
) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    const resolvedParams = params instanceof Promise ? await params : params
    const deliveryId = resolvedParams.id
    const body = await request.json()

    // 构建更新数据
    const updateData: any = {}

    if (body.driver_id !== undefined) {
      updateData.driver_id = body.driver_id ? BigInt(body.driver_id) : null
    }
    if (body.status !== undefined) {
      updateData.status = body.status
    }
    if (body.notes !== undefined) {
      updateData.notes = body.notes
    }

    // 应用系统字段
    const user = authResult.user || null
    await addSystemFields(updateData, user, false)

    const updated = await prisma.delivery_management.update({
      where: { delivery_id: BigInt(deliveryId) },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      data: serializeBigInt(updated),
    })
  } catch (error: any) {
    console.error('更新送仓管理记录失败:', error)
    return NextResponse.json(
      { error: error.message || '更新送仓管理记录失败' },
      { status: 500 }
    )
  }
}

// PATCH - 更新送仓管理记录
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  return updateDeliveryManagement(request, params)
}

// PUT - 更新送仓管理记录（兼容标准 REST API）
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  return updateDeliveryManagement(request, params)
}

