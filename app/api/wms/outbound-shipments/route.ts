import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, handleError, serializeBigInt, addSystemFields } from '@/lib/api/helpers';
import prisma from '@/lib/prisma';

// GET - 获取出库管理列表（从 outbound_shipments 表查询，关联 delivery_appointments 获取其他字段）
export async function GET(request: NextRequest) {
  try {
    // 检查登录
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const sort = searchParams.get('sort') || 'created_at';
    const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
    const search = searchParams.get('search') || '';

    // 构建查询条件：只显示非直送的预约
    // 从 outbound_shipments 查询，关联 delivery_appointments
    // 由于只有非直送的预约才会在 outbound_shipments 表中创建记录，所以直接查询即可
    const where: any = {
      delivery_appointments: {
        delivery_method: {
          not: '直送',
        },
      },
    };

    // 搜索条件
    if (search) {
      const searchConditions: any[] = [
        { notes: { contains: search, mode: 'insensitive' } },
        { delivery_appointments: { reference_number: { contains: search } } },
        { delivery_appointments: { delivery_method: { contains: search, mode: 'insensitive' } } },
        { delivery_appointments: { appointment_account: { contains: search, mode: 'insensitive' } } },
      ];
      
      // 如果已有 where.AND，合并条件；否则创建新的 AND 数组
      if (where.AND) {
        where.AND.push({
          OR: searchConditions,
        });
      } else {
        where.AND = [
          {
            OR: searchConditions,
          },
        ];
      }
    }

    // 排序
    const orderBy: any = {};
    if (sort === 'reference_number' || sort === 'appointment_type' || sort === 'loaded_by_name' || 
        sort === 'origin_location' || sort === 'trailer_code' || 
        sort === 'destination_location' || sort === 'total_pallets') {
      // 这些字段来自关联表或计算字段，先按创建时间排序
      orderBy.created_at = 'desc';
    } else {
      orderBy[sort] = order;
    }

    // 查询 outbound_shipments（只显示非直送的预约）
    let shipments: any[] = [];
    let total = 0;
    
    try {
      [shipments, total] = await Promise.all([
        prisma.outbound_shipments.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
          include: {
            delivery_appointments: {
              include: {
                orders: {
                  select: {
                    order_id: true,
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
              },
            },
          },
        }),
        prisma.outbound_shipments.count({ where }),
      ]);
    } catch (queryError: any) {
      console.error('Prisma 查询错误:', queryError);
      return NextResponse.json(
        {
          error: '获取出库管理列表失败',
          message: queryError.message,
        },
        { status: 500 }
      );
    }

    // 序列化并格式化数据
    const serializedItems = shipments.map((shipment: any) => {
      const serialized = serializeBigInt(shipment);
      const appointment = serialized.delivery_appointments;
      
      if (!appointment) {
        // 如果没有关联的预约，跳过这条记录
        return null;
      }

      const serializedAppointment = serializeBigInt(appointment);
      
      // 计算总板数：从 order_detail.estimated_pallets 求和
      let totalPallets = 0;
      if (serializedAppointment.orders?.order_detail && Array.isArray(serializedAppointment.orders.order_detail)) {
        totalPallets = serializedAppointment.orders.order_detail.reduce((sum: number, detail: any) => {
          return sum + (detail.estimated_pallets || 0);
        }, 0);
      }

      return {
        // 从 delivery_appointments 获取的字段
        appointment_id: serializedAppointment.appointment_id.toString(),
        reference_number: serializedAppointment.reference_number || null,
        delivery_method: serializedAppointment.delivery_method || null,
        rejected: serializedAppointment.rejected || false,
        appointment_account: serializedAppointment.appointment_account || null,
        appointment_type: serializedAppointment.appointment_type || null,
        origin_location: serializedAppointment.locations_delivery_appointments_origin_location_idTolocations?.location_code || null,
        destination_location: serializedAppointment.locations?.location_code || null,
        confirmed_start: serializedAppointment.confirmed_start || null,
        total_pallets: totalPallets,
        
        // 从 outbound_shipments 获取的字段（自有字段）
        outbound_shipment_id: serialized.outbound_shipment_id.toString(),
        trailer_id: serialized.trailer_id ? serialized.trailer_id.toString() : null,
        trailer_code: serialized.trailers?.trailer_code || null,
        loaded_by: serialized.loaded_by ? serialized.loaded_by.toString() : null,
        loaded_by_name: serialized.users_outbound_shipments_loaded_byTousers?.full_name || null,
        notes: serialized.notes || null,
        
        // 审计字段
        created_at: serialized.created_at,
        updated_at: serialized.updated_at,
      };
    }).filter((item: any) => item !== null); // 过滤掉 null 值

    return NextResponse.json({
      data: serializedItems,
      total,
      page,
      limit,
    });
  } catch (error: any) {
    console.error('获取出库管理列表失败:', error);
    return NextResponse.json(
      {
        error: '获取出库管理列表失败',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

// POST - 不允许创建（出库管理记录应该从 delivery_appointments 自动生成）
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: '出库管理记录不能手动创建，它们会自动从预约管理中生成' },
    { status: 405 }
  );
}
