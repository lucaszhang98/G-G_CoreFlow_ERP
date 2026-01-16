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
                    order_id: true,
                    orders: {
                      select: {
                        order_id: true,
                        order_number: true,
                      },
                    },
                  },
                },
              },
            },
            outbound_shipments: {
              select: {
                outbound_shipment_id: true,
                trailer_id: true,
                trailer_code: true, // trailer_code 现在是直接存储在 outbound_shipments 表中的文本字段
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

    // 优先从 delivery_management.container_number 获取柜号（如果已存储）
    // 如果没有存储，则根据派送方式自动计算并更新
    let containerNumber: string | null = serialized.container_number || null
    
    // 如果表中没有柜号，根据派送方式自动获取
    if (!containerNumber) {
      if (appointment?.delivery_method === '直送') {
        // 直送：从 orders.order_number 获取
        containerNumber = order?.order_number || null
      } else if (appointment?.delivery_method === '卡派' || appointment?.delivery_method === '自提') {
        // 卡派/自提：从 outbound_shipments.trailer_code 获取（现在是直接存储在表中的文本字段）
        containerNumber = appointment?.outbound_shipments?.trailer_code || null
      }
      
      // 如果计算出了柜号但表中没有，自动更新到数据库（异步，不阻塞响应）
      if (containerNumber) {
        prisma.delivery_management.update({
          where: { delivery_id: BigInt(serialized.delivery_id) },
          data: { container_number: containerNumber } as any,
        }).catch(err => {
          console.error(`[送仓管理] 自动更新柜号失败 (delivery_id: ${serialized.delivery_id}):`, err)
        })
      }
    }

    return NextResponse.json({
      delivery_id: String(serialized.delivery_id || ''),
      appointment_number: appointment?.reference_number || null,
      container_number: containerNumber,
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
      driver_name: serialized.drivers?.contact_roles?.name || serialized.drivers?.driver_code || null,
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

    // container_number 不可手动编辑，由系统自动更新
    // if (body.container_number !== undefined) {
    //   updateData.container_number = body.container_number || null
    // }
    if (body.driver_id !== undefined) {
      updateData.driver_id = body.driver_id ? BigInt(body.driver_id) : null
    }
    if (body.status !== undefined) {
      updateData.status = body.status
    }
    if (body.notes !== undefined) {
      updateData.notes = body.notes
    }

    // rejected 字段在 delivery_appointments 表中，需要单独更新
    const appointmentUpdateData: any = {}
    if (body.rejected !== undefined) {
      appointmentUpdateData.rejected = Boolean(body.rejected)
    }

    // 应用系统字段
    const user = authResult.user || null
    await addSystemFields(updateData, user, false)

    // 获取 appointment_id，用于更新 delivery_appointments
    const delivery = await prisma.delivery_management.findUnique({
      where: { delivery_id: BigInt(deliveryId) },
      select: { appointment_id: true },
    })

    if (!delivery) {
      return NextResponse.json(
        { error: '送仓管理记录不存在' },
        { status: 404 }
      )
    }

    // 使用事务同时更新 delivery_management 和 delivery_appointments
    const result = await prisma.$transaction(async (tx) => {
      // 更新 delivery_management
      const updated = await tx.delivery_management.update({
        where: { delivery_id: BigInt(deliveryId) },
        data: updateData,
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

      // 更新 delivery_appointments.rejected（如果有）
      if (Object.keys(appointmentUpdateData).length > 0) {
        await tx.delivery_appointments.update({
          where: { appointment_id: delivery.appointment_id },
          data: appointmentUpdateData,
        })
      }

      return updated
    })

    return NextResponse.json({
      success: true,
      data: serializeBigInt(result),
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

