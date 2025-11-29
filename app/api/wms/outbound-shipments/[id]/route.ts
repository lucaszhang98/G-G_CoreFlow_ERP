import { NextRequest, NextResponse } from 'next/server';
import { checkPermission, handleValidationError, handleError, serializeBigInt, addSystemFields } from '@/lib/api/helpers';
import { outboundShipmentUpdateSchema } from '@/lib/validations/outbound-shipment';
import prisma from '@/lib/prisma';

// GET - 获取单个出库管理记录
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = resolvedParams.id;

    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { error: '无效的出库管理ID' },
        { status: 400 }
      );
    }

    const includeConfig = {
      locations: {
        select: {
          location_id: true,
          name: true,
          location_code: true,
        },
      },
      locations_outbound_shipments_origin_location_idTolocations: {
        select: {
          location_id: true,
          name: true,
          location_code: true,
        },
      },
      drivers: {
        select: {
          driver_id: true,
          driver_code: true,
        },
      },
      trailers: {
        select: {
          trailer_id: true,
          trailer_code: true,
        },
      },
      users_outbound_shipments_loaded_byTousers: {
        select: {
          id: true,
          full_name: true,
          username: true,
        },
      },
      outbound_shipment_lines: {
        select: {
          order_id: true,
          orders: {
            select: {
              order_id: true,
              delivery_appointments: {
                select: {
                  appointment_id: true,
                  reference_number: true,
                  appointment_type_code: true,
                  appointment_types: {
                    select: {
                      appointment_type_code: true,
                      description: true,
                    },
                  },
                },
                take: 1,
              },
            },
          },
        },
      },
    };

    const item = await prisma.outbound_shipments.findUnique({
      where: { outbound_shipment_id: BigInt(id) },
      include: includeConfig,
    });

    if (!item) {
      return NextResponse.json(
        { error: '出库管理记录不存在' },
        { status: 404 }
      );
    }

    const serialized = serializeBigInt(item);
    
    // 格式化数据
    // 预约号码直接使用shipment_number
    const shipmentNumber = serialized.shipment_number || null;
    
    // 从关联的delivery_appointments获取预约类型（如果需要）
    const appointment = serialized.outbound_shipment_lines?.[0]?.orders?.delivery_appointments?.[0];
    const appointmentType = appointment?.appointment_types?.description || null;
    const loadedByName = serialized.users_outbound_shipments_loaded_byTousers?.full_name || null;
    const originLocation = serialized.locations_outbound_shipments_origin_location_idTolocations?.name || null;
    const driverName = serialized.drivers?.driver_code || null;
    const trailerCode = serialized.trailers?.trailer_code || null;
    const destinationLocation = serialized.locations?.name || null;

    return NextResponse.json({
      ...serialized,
      shipment_number: shipmentNumber,
      appointment_type: appointmentType,
      loaded_by_name: loadedByName,
      origin_location: originLocation,
      driver_name: driverName,
      trailer_code: trailerCode,
      destination_location: destinationLocation,
    });
  } catch (error: any) {
    console.error('获取出库管理记录失败:', error);
    return handleError(error);
  }
}

// PUT - 更新出库管理记录
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = resolvedParams.id;

    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { error: '无效的出库管理ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    
    // 验证输入
    const validationResult = outboundShipmentUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return handleValidationError(validationResult.error);
    }

    const data = validationResult.data;
    
    // 获取当前用户
    const currentUser = await checkPermission([]);
    const user = currentUser.user || null;

    // 构建更新数据
    const updateData: any = {};
    
    if (data.warehouse_id !== undefined) {
      updateData.warehouse_id = typeof data.warehouse_id === 'bigint' ? data.warehouse_id : BigInt(data.warehouse_id);
    }
    if (data.destination_location_id !== undefined) {
      updateData.destination_location_id = typeof data.destination_location_id === 'bigint' 
        ? data.destination_location_id 
        : BigInt(data.destination_location_id);
    }
    if (data.shipment_number !== undefined) updateData.shipment_number = data.shipment_number;
    if (data.scheduled_load_time !== undefined) {
      updateData.scheduled_load_time = data.scheduled_load_time ? new Date(data.scheduled_load_time) : null;
    }
    if (data.actual_load_time !== undefined) {
      updateData.actual_load_time = data.actual_load_time ? new Date(data.actual_load_time) : null;
    }
    if (data.status !== undefined) updateData.status = data.status;
    if (data.total_pallets !== undefined) updateData.total_pallets = data.total_pallets;
    if (data.total_volume !== undefined) updateData.total_volume = data.total_volume;
    if (data.total_weight !== undefined) updateData.total_weight = data.total_weight;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.trailer_id !== undefined) {
      updateData.trailer_id = data.trailer_id ? (typeof data.trailer_id === 'bigint' ? data.trailer_id : BigInt(data.trailer_id)) : null;
    }
    if (data.loaded_by !== undefined) {
      updateData.loaded_by = data.loaded_by ? (typeof data.loaded_by === 'bigint' ? data.loaded_by : BigInt(data.loaded_by)) : null;
    }
    if (data.bol_document_id !== undefined) {
      updateData.bol_document_id = data.bol_document_id ? (typeof data.bol_document_id === 'bigint' ? data.bol_document_id : BigInt(data.bol_document_id)) : null;
    }
    if (data.load_sheet_document_id !== undefined) {
      updateData.load_sheet_document_id = data.load_sheet_document_id ? (typeof data.load_sheet_document_id === 'bigint' ? data.load_sheet_document_id : BigInt(data.load_sheet_document_id)) : null;
    }
    // 新增字段
    if (data.delivery_method !== undefined) updateData.delivery_method = data.delivery_method;
    if (data.is_rejected !== undefined) updateData.is_rejected = data.is_rejected;
    if (data.appointment_account !== undefined) updateData.appointment_account = data.appointment_account;
    if (data.driver_id !== undefined) {
      updateData.driver_id = data.driver_id ? (typeof data.driver_id === 'bigint' ? data.driver_id : BigInt(data.driver_id)) : null;
    }
    if (data.origin_location_id !== undefined) {
      updateData.origin_location_id = data.origin_location_id ? (typeof data.origin_location_id === 'bigint' ? data.origin_location_id : BigInt(data.origin_location_id)) : null;
    }

    // 应用系统字段
    const finalData = addSystemFields(updateData, user, false);

    // 更新记录
    const updatedItem = await prisma.outbound_shipments.update({
      where: { outbound_shipment_id: BigInt(id) },
      data: finalData,
    });

    const serialized = serializeBigInt(updatedItem);
    return NextResponse.json(serialized);
  } catch (error: any) {
    console.error('更新出库管理记录失败:', error);
    return handleError(error);
  }
}

// DELETE - 删除出库管理记录
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = resolvedParams.id;

    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { error: '无效的出库管理ID' },
        { status: 400 }
      );
    }

    await prisma.outbound_shipments.delete({
      where: { outbound_shipment_id: BigInt(id) },
    });

    return NextResponse.json({ message: '出库管理记录已删除' });
  } catch (error: any) {
    console.error('删除出库管理记录失败:', error);
    return handleError(error);
  }
}

