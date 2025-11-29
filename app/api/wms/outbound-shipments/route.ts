import { NextRequest, NextResponse } from 'next/server';
import { checkPermission, handleValidationError, handleError, serializeBigInt, addSystemFields } from '@/lib/api/helpers';
import { outboundShipmentCreateSchema } from '@/lib/validations/outbound-shipment';
import prisma from '@/lib/prisma';
import { outboundShipmentConfig } from '@/lib/crud/configs/outbound-shipments';

// GET - 获取出库管理列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const sort = searchParams.get('sort') || 'created_at';
    const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
    const search = searchParams.get('search') || '';

    // 构建查询条件
    const where: any = {};

    // 搜索条件
    if (search) {
      const searchConditions: any[] = [
        { shipment_number: { contains: search } },
        { delivery_method: { contains: search } },
        { appointment_account: { contains: search } },
        { notes: { contains: search } },
      ];
      
      where.OR = searchConditions;
    }

    // 排序
    const orderBy: any = {};
    if (sort === 'shipment_number' || sort === 'appointment_type' || sort === 'loaded_by_name' || 
        sort === 'origin_location' || sort === 'driver_name' || sort === 'trailer_code' || 
        sort === 'destination_location') {
      // 这些字段来自关联表或计算字段，先按创建时间排序
      orderBy.created_at = 'desc';
    } else {
      orderBy[sort] = order;
    }

    // 构建 include 对象
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

    // 查询数据
    const [items, total] = await Promise.all([
      prisma.outbound_shipments.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: includeConfig,
      }),
      prisma.outbound_shipments.count({ where }),
    ]);

    // 序列化并格式化数据
    const serializedItems = items.map((item: any) => {
      const serialized = serializeBigInt(item);
      
      // 预约号码直接使用shipment_number
      const shipmentNumber = serialized.shipment_number || null;
      
      // 从关联的delivery_appointments获取预约类型（如果需要）
      const appointment = serialized.outbound_shipment_lines?.[0]?.orders?.delivery_appointments?.[0];
      const appointmentType = appointment?.appointment_types?.description || null;
      
      // 获取装车人名称
      const loadedByName = serialized.users_outbound_shipments_loaded_byTousers?.full_name || null;
      
      // 获取起始地
      const originLocation = serialized.locations_outbound_shipments_origin_location_idTolocations?.name || null;
      
      // 获取司机名称
      const driverName = serialized.drivers?.driver_code || null;
      
      // 获取trailer代码
      const trailerCode = serialized.trailers?.trailer_code || null;
      
      // 获取目的地
      const destinationLocation = serialized.locations?.name || null;

      return {
        ...serialized,
        shipment_number: shipmentNumber,
        appointment_type: appointmentType,
        loaded_by_name: loadedByName,
        origin_location: originLocation,
        driver_name: driverName,
        trailer_code: trailerCode,
        destination_location: destinationLocation,
      };
    });

    return NextResponse.json({
      data: serializedItems,
      total,
      page,
      limit,
    });
  } catch (error: any) {
    console.error('获取出库管理列表失败:', error);
    return handleError(error);
  }
}

// POST - 创建出库管理记录
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 验证输入
    const validationResult = outboundShipmentCreateSchema.safeParse(body);
    if (!validationResult.success) {
      return handleValidationError(validationResult.error);
    }

    const data = validationResult.data;
    
    // 获取当前用户（用于审计字段）
    const currentUser = await checkPermission([]);
    if (currentUser.error) {
      // 如果没有权限检查，使用默认值
    }

    // 构建创建数据
    const createData: any = {
      warehouse_id: typeof data.warehouse_id === 'bigint' ? data.warehouse_id : BigInt(data.warehouse_id),
      destination_location_id: typeof data.destination_location_id === 'bigint' 
        ? data.destination_location_id 
        : BigInt(data.destination_location_id),
      shipment_number: data.shipment_number || null,
      scheduled_load_time: data.scheduled_load_time ? new Date(data.scheduled_load_time) : null,
      actual_load_time: data.actual_load_time ? new Date(data.actual_load_time) : null,
      status: data.status || 'planned',
      total_pallets: data.total_pallets || null,
      total_volume: data.total_volume || null,
      total_weight: data.total_weight || null,
      notes: data.notes || null,
      trailer_id: data.trailer_id ? (typeof data.trailer_id === 'bigint' ? data.trailer_id : BigInt(data.trailer_id)) : null,
      loaded_by: data.loaded_by ? (typeof data.loaded_by === 'bigint' ? data.loaded_by : BigInt(data.loaded_by)) : null,
      bol_document_id: data.bol_document_id ? (typeof data.bol_document_id === 'bigint' ? data.bol_document_id : BigInt(data.bol_document_id)) : null,
      load_sheet_document_id: data.load_sheet_document_id ? (typeof data.load_sheet_document_id === 'bigint' ? data.load_sheet_document_id : BigInt(data.load_sheet_document_id)) : null,
      // 新增字段
      delivery_method: data.delivery_method || null,
      is_rejected: data.is_rejected ?? false,
      appointment_account: data.appointment_account || null,
      driver_id: data.driver_id ? (typeof data.driver_id === 'bigint' ? data.driver_id : BigInt(data.driver_id)) : null,
      origin_location_id: data.origin_location_id ? (typeof data.origin_location_id === 'bigint' ? data.origin_location_id : BigInt(data.origin_location_id)) : null,
    };

    // 应用系统字段
    const user = currentUser.user || null;
    const finalData = addSystemFields(createData, user, true);

    // 创建记录
    const newItem = await prisma.outbound_shipments.create({
      data: finalData,
    });

    const serialized = serializeBigInt(newItem);
    return NextResponse.json(serialized, { status: 201 });
  } catch (error: any) {
    console.error('创建出库管理记录失败:', error);
    return handleError(error);
  }
}

