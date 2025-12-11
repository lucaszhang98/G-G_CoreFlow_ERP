import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, handleError, serializeBigInt, addSystemFields } from '@/lib/api/helpers';
import prisma from '@/lib/prisma';
import { outboundShipmentConfig } from '@/lib/crud/configs/outbound-shipments';
import { buildFilterConditions, mergeFilterConditions } from '@/lib/crud/filter-helper';
import { enhanceConfigWithSearchFields } from '@/lib/crud/search-config-generator';

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

    // 增强配置，确保 filterFields 已生成
    const enhancedConfig = enhanceConfigWithSearchFields(outboundShipmentConfig)

    // 构建查询条件：只显示非直送的预约
    // 直接从 delivery_appointments 查询非直送的预约，然后关联 outbound_shipments
    // 这样即使 outbound_shipments 记录不存在，也能显示所有非直送预约
    const where: any = {
      delivery_appointments: {
        delivery_method: {
          not: '直送',
        },
      },
    };

    // 使用统一的筛选逻辑
    const filterConditions = buildFilterConditions(enhancedConfig, searchParams)
    
    // 注意：出库管理实际查询的是 delivery_appointments 表，所以筛选条件应该直接应用到 appointmentWhere
    // 分离主表字段和关联表字段的筛选条件
    const appointmentsConditions: any = {}
    const dateConditions: any[] = [] // 用于存储 delivery_date 和 appointment_time 的日期筛选条件
    
    filterConditions.forEach((condition) => {
      Object.keys(condition).forEach((fieldName) => {
        // 所有字段都来自 delivery_appointments 表（因为实际查询的是 delivery_appointments）
        // 需要映射字段名：
        // - destination_location_id -> location_id
        // - confirmed_start 和 requested_start 的日期筛选需要特殊处理
        let mappedFieldName = fieldName
        
        if (fieldName === 'destination_location_id') {
          mappedFieldName = 'location_id'
          appointmentsConditions[mappedFieldName] = condition[fieldName]
        } else if (fieldName === 'confirmed_start') {
          // confirmed_start 是 datetime 类型，直接使用
          appointmentsConditions[fieldName] = condition[fieldName]
        } else if (fieldName === 'origin_location_id') {
          // origin_location_id 直接使用
          appointmentsConditions[fieldName] = condition[fieldName]
        } else {
          // 其他字段直接映射
          appointmentsConditions[fieldName] = condition[fieldName]
        }
      })
    })

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

    // 查询所有非直送的预约，然后关联 outbound_shipments
    // 这样即使 outbound_shipments 记录不存在，也能显示所有非直送预约
    let appointments: any[] = [];
    let total = 0;
    
    // 先查询所有非直送的预约
    // 注意：由于实际查询的是 delivery_appointments 表，筛选条件应该直接应用到 appointmentWhere
    const appointmentWhere: any = {
      delivery_method: {
        not: '直送',
      },
    };
    
    // 将筛选条件应用到 appointmentWhere（因为实际查询的是 delivery_appointments 表）
    if (Object.keys(appointmentsConditions).length > 0) {
      // 如果有多个条件，使用 AND 逻辑组合
      const conditionKeys = Object.keys(appointmentsConditions)
      if (conditionKeys.length === 1) {
        // 只有一个条件，直接合并
        Object.assign(appointmentWhere, appointmentsConditions)
      } else {
        // 多个条件，使用 AND 逻辑
        appointmentWhere.AND = [
          { delivery_method: { not: '直送' } },
          ...conditionKeys.map(key => ({ [key]: appointmentsConditions[key] })),
        ]
        // 移除单独的 delivery_method 条件，因为已经在 AND 中
        delete appointmentWhere.delivery_method
      }
    }
    
    // 搜索条件
    if (search) {
      const searchConditions: any[] = [
        { reference_number: { contains: search } },
        { appointment_account: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
      
      // 如果已有 AND 条件，将搜索条件添加到 AND 中
      if (appointmentWhere.AND) {
        appointmentWhere.AND.push({
          OR: searchConditions,
        })
      } else if (appointmentWhere.OR) {
        // 如果已有 OR 条件，合并
        appointmentWhere.OR = [...(Array.isArray(appointmentWhere.OR) ? appointmentWhere.OR : [appointmentWhere.OR]), ...searchConditions];
      } else {
        // 创建新的 OR 条件
        appointmentWhere.OR = searchConditions
      }
    }
    
    try {
      [appointments, total] = await Promise.all([
        prisma.delivery_appointments.findMany({
          where: appointmentWhere,
          orderBy: {
            created_at: order === 'asc' ? 'asc' : 'desc',
          },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            orders: {
              select: {
                order_id: true,
                status: true,
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
              include: {
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
            },
            appointment_detail_lines: {
              select: {
                estimated_pallets: true,
              },
            },
          },
        }),
        prisma.delivery_appointments.count({ where: appointmentWhere }),
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
    const serializedItems = appointments.map((appointment: any) => {
      const serializedAppointment = serializeBigInt(appointment);
      const shipment = serializedAppointment.outbound_shipments;
      
      // 计算总板数：从 appointment_detail_lines.estimated_pallets 累加
      let totalPallets = 0;
      if (serializedAppointment.appointment_detail_lines && Array.isArray(serializedAppointment.appointment_detail_lines)) {
        totalPallets = serializedAppointment.appointment_detail_lines.reduce((sum: number, line: any) => {
          return sum + (line.estimated_pallets || 0);
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
        total_pallets: totalPallets, // 从 appointment_detail_lines.estimated_pallets 累加
        
        // 从 outbound_shipments 获取的字段（如果存在）
        outbound_shipment_id: shipment ? serializeBigInt(shipment).outbound_shipment_id?.toString() : null,
        trailer_id: shipment?.trailer_id ? shipment.trailer_id.toString() : null,
        trailer_code: shipment?.trailers?.trailer_code || null,
        loaded_by: shipment?.loaded_by ? shipment.loaded_by.toString() : null,
        loaded_by_name: shipment?.users_outbound_shipments_loaded_byTousers?.full_name || null,
        notes: shipment?.notes || null,
        
        // 审计字段
        created_at: serializedAppointment.created_at,
        updated_at: serializedAppointment.updated_at,
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
