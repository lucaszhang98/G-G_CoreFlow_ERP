import { NextRequest, NextResponse } from 'next/server'
import { checkAuth, serializeBigInt, addSystemFields } from '@/lib/api/helpers'
import prisma from '@/lib/prisma'

// GET - 获取单个提柜管理记录
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    const resolvedParams = params instanceof Promise ? await params : params
    const pickupId = resolvedParams.id

    const pickup = await prisma.pickup_management.findUnique({
      where: { pickup_id: BigInt(pickupId) },
      include: {
        orders: {
          select: {
            order_id: true,
            order_number: true,
            order_date: true,
            mbl_number: true,
            do_issued: true,
            container_type: true,
            eta_date: true,
            lfd_date: true,
            pickup_date: true,
            ready_date: true,
            return_deadline: true,
            warehouse_account: true,
            operation_mode: true,
            port_location: true,
            port_location_id: true,
            delivery_location: true,
            delivery_location_id: true,
            carrier_id: true,
            locations_orders_port_location_idTolocations: {
              select: {
                location_id: true,
                name: true,
                location_code: true,
                location_type: true,
              },
            },
            locations_orders_delivery_location_idTolocations: {
              select: {
                location_id: true,
                name: true,
                location_code: true,
                location_type: true,
              },
            },
            customers: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            carriers: {
              select: {
                carrier_id: true,
                name: true,
                carrier_code: true,
              },
            },
          },
        },
        drivers: {
          select: {
            driver_id: true,
            driver_code: true,
            license_number: true,
            license_plate: true,
          },
        },
      },
    })

    if (!pickup) {
      return NextResponse.json({ error: '提柜管理记录不存在' }, { status: 404 })
    }

    const serialized = serializeBigInt(pickup)
    const order = serialized.orders

    return NextResponse.json({
      pickup_id: String(serialized.pickup_id || ''),
      // 订单基础信息
      container_number: order?.order_number || null,
      mbl: order?.mbl_number || null,
      customer: order?.customers || null, // 返回完整的 customer 对象，用于 relation 类型字段
      customer_id: order?.customers?.id ? String(order.customers.id) : null,
      container_type: order?.container_type || null,
      do_issued: order?.do_issued || false,
      order_date: order?.order_date || null,
      eta_date: order?.eta_date || null,
      operation_mode: order?.operation_mode || null,
      operation_mode_display: order?.operation_mode === 'unload' ? '拆柜' : order?.operation_mode === 'direct_delivery' ? '直送' : order?.operation_mode || null,
      delivery_location: order?.locations_orders_delivery_location_idTolocations?.location_code || order?.delivery_location || null,
      delivery_location_id: order?.delivery_location_id ? String(order.delivery_location_id) : null,
      lfd_date: order?.lfd_date || null,
      pickup_date: order?.pickup_date || null,
      ready_date: order?.ready_date || null,
      return_deadline: order?.return_deadline || null,
      warehouse_account: order?.warehouse_account || null,
      port_location: order?.locations_orders_port_location_idTolocations?.location_code || null, // 返回location_code（数字代码）
      port_location_id: order?.port_location_id ? String(order.port_location_id) : null,
      carrier: order?.carriers || null, // 返回完整的 carrier 对象，用于 relation 类型字段
      carrier_id: order?.carrier_id ? String(order.carrier_id) : null,
      // 提柜管理自有字段
      port_text: serialized.port_text || null,
      shipping_line: serialized.shipping_line || null,
      driver: serialized.drivers || null, // 返回完整的 driver 对象
      driver_id: serialized.driver_id ? String(serialized.driver_id) : null,
      earliest_appointment_time: serialized.earliest_appointment_time || null,
      current_location: serialized.current_location || null,
      status: serialized.status || null,
      notes: serialized.notes || null,
      // 额外信息
      order_id: order ? String(order.order_id || '') : null,
      order_number: order?.order_number || null,
      created_at: serialized.created_at || null,
      updated_at: serialized.updated_at || null,
    })
  } catch (error: any) {
    console.error('获取提柜管理记录失败:', error)
    return NextResponse.json(
      { error: error.message || '获取提柜管理记录失败' },
      { status: 500 }
    )
  }
}

// 更新提柜管理记录的共享逻辑
async function updatePickupManagement(
  request: NextRequest,
  params: Promise<{ id: string }> | { id: string }
) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    const resolvedParams = params instanceof Promise ? await params : params
    const pickupId = resolvedParams.id
    const body = await request.json()

    // 调试：查看前端发送的数据
    console.log('[提柜管理更新] 收到的数据:', JSON.stringify(body, null, 2))

    // 获取 pickup_management 记录，以获取关联的 order_id
    const pickup = await prisma.pickup_management.findUnique({
      where: { pickup_id: BigInt(pickupId) },
      select: { order_id: true },
    })

    if (!pickup) {
      return NextResponse.json({ error: '提柜管理记录不存在' }, { status: 404 })
    }

    // 构建更新数据
    const pickupUpdateData: any = {}
    const orderUpdateData: any = {}

    // 提柜管理自有字段
    if (body.status !== undefined) {
      pickupUpdateData.status = body.status
    }
    if (body.current_location !== undefined) {
      pickupUpdateData.current_location = body.current_location || null
    }
    if (body.port_text !== undefined) {
      pickupUpdateData.port_text = body.port_text || null
    }
    if (body.shipping_line !== undefined) {
      pickupUpdateData.shipping_line = body.shipping_line || null
    }
    if (body.driver_id !== undefined) {
      pickupUpdateData.driver_id = body.driver_id 
        ? BigInt(body.driver_id) 
        : null
    }
    if (body.notes !== undefined) {
      pickupUpdateData.notes = body.notes
    }

    // 订单字段（通过提柜管理修改）
    if (body.port_location_id !== undefined) {
      orderUpdateData.port_location_id = body.port_location_id 
        ? BigInt(body.port_location_id) 
        : null
    }
    if (body.carrier_id !== undefined) {
      orderUpdateData.carrier_id = body.carrier_id 
        ? BigInt(body.carrier_id) 
        : null
    }
    if (body.container_type !== undefined) {
      orderUpdateData.container_type = body.container_type || null
    }
    // 日期字段
    if (body.lfd_date !== undefined) {
      orderUpdateData.lfd_date = body.lfd_date 
        ? new Date(body.lfd_date) 
        : null
    }
    if (body.pickup_date !== undefined) {
      if (body.pickup_date) {
        // 不转换时区！直接将输入的日期时间当作UTC时间存储
        // 输入格式：YYYY-MM-DDTHH:mm 或 ISO字符串
        const dateTimeStr = body.pickup_date
        if (dateTimeStr.includes('T')) {
          const [datePart, timePart] = dateTimeStr.split('T')
          const [year, month, day] = datePart.split('-').map(Number)
          const timeWithSeconds = timePart.includes('Z') ? timePart.replace('Z', '') : timePart
          const [hours, minutes, seconds = 0] = timeWithSeconds.split(':').map(Number)
          // 使用Date.UTC直接创建UTC时间，不做任何时区转换
          orderUpdateData.pickup_date = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds))
        } else {
          // 如果是纯日期，补充00:00:00
          orderUpdateData.pickup_date = new Date(body.pickup_date + 'T00:00:00Z')
        }
      } else {
        orderUpdateData.pickup_date = null
      }
    }
    if (body.ready_date !== undefined) {
      orderUpdateData.ready_date = body.ready_date 
        ? new Date(body.ready_date) 
        : null
    }
    if (body.return_deadline !== undefined) {
      orderUpdateData.return_deadline = body.return_deadline 
        ? new Date(body.return_deadline) 
        : null
    }

    // 调试：查看要更新的数据
    console.log('[提柜管理更新] pickupUpdateData:', JSON.stringify(pickupUpdateData, null, 2))
    console.log('[提柜管理更新] orderUpdateData:', JSON.stringify(orderUpdateData, null, 2))

    // 应用系统字段到 pickup_management
    const user = authResult.user || null
    if (Object.keys(pickupUpdateData).length > 0) {
      await addSystemFields(pickupUpdateData, user, false)
      console.log('[提柜管理更新] 准备更新 pickup_management，数据:', JSON.stringify(pickupUpdateData, null, 2))
      await prisma.pickup_management.update({
        where: { pickup_id: BigInt(pickupId) },
        data: pickupUpdateData,
      })
    }

    // 更新 orders 表（如果有关联字段需要更新）
    if (Object.keys(orderUpdateData).length > 0) {
      await addSystemFields(orderUpdateData, user, false)
      console.log('[提柜管理更新] 准备更新 orders，数据:', JSON.stringify(orderUpdateData, null, 2))
      await prisma.orders.update({
        where: { order_id: pickup.order_id },
        data: orderUpdateData,
      })
    }

    // 重新获取更新后的数据
    const updated = await prisma.pickup_management.findUnique({
      where: { pickup_id: BigInt(pickupId) },
      include: {
        orders: {
          select: {
            order_id: true,
            container_type: true,
            port_location_id: true,
            carrier_id: true,
            lfd_date: true,
            pickup_date: true,
            ready_date: true,
            return_deadline: true,
            locations_orders_port_location_idTolocations: {
              select: {
                location_id: true,
                name: true,
                location_code: true,
                location_type: true,
              },
            },
            carriers: {
              select: {
                carrier_id: true,
                name: true,
                carrier_code: true,
              },
            },
          },
        },
        drivers: {
          select: {
            driver_id: true,
            driver_code: true,
            license_number: true,
            license_plate: true,
          },
        },
      },
    })

    const serializedUpdated = serializeBigInt(updated)
    const updatedOrder = serializedUpdated?.orders

    // 构建返回数据，确保所有字段都已序列化
    const responseData = {
      pickup_id: String(serializedUpdated.pickup_id || ''),
      current_location: serializedUpdated.current_location || null,
      port_text: serializedUpdated.port_text || null,
      shipping_line: serializedUpdated.shipping_line || null,
      driver: serializedUpdated.drivers || null,
      driver_id: serializedUpdated.driver_id ? String(serializedUpdated.driver_id) : null,
      status: serializedUpdated.status || null,
      notes: serializedUpdated.notes || null,
      container_type: updatedOrder?.container_type || null,
      port_location: updatedOrder?.locations_orders_port_location_idTolocations?.location_code || null,
      port_location_id: updatedOrder?.port_location_id ? String(updatedOrder.port_location_id) : null,
      carrier: updatedOrder?.carriers || null,
      carrier_id: updatedOrder?.carrier_id ? String(updatedOrder.carrier_id) : null,
      lfd_date: updatedOrder?.lfd_date || null,
      pickup_date: updatedOrder?.pickup_date || null,
      ready_date: updatedOrder?.ready_date || null,
      return_deadline: updatedOrder?.return_deadline || null,
    }

    console.log('[提柜管理更新] 返回数据:', JSON.stringify(responseData, null, 2))

    return NextResponse.json({
      success: true,
      data: responseData,
    })
  } catch (error: any) {
    console.error('更新提柜管理记录失败:', error)
    return NextResponse.json(
      { error: error.message || '更新提柜管理记录失败' },
      { status: 500 }
    )
  }
}

// PATCH - 更新提柜管理记录
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  return updatePickupManagement(request, params)
}

// PUT - 更新提柜管理记录（兼容标准 REST API）
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  return updatePickupManagement(request, params)
}

