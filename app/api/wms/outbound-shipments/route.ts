import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, serializeBigInt } from '@/lib/api/helpers';
import prisma from '@/lib/prisma';
import { withActiveDeliveryAppointmentsWhere } from '@/lib/utils/delivery-appointment-enabled';
import { outboundShipmentConfig } from '@/lib/crud/configs/outbound-shipments';
import { buildFilterConditions } from '@/lib/crud/filter-helper';
import { enhanceConfigWithSearchFields } from '@/lib/crud/search-config-generator';
import { resolveCurrentWarehouseId } from '@/lib/warehouse/current-warehouse';
import { buildDeliveryAppointmentWarehouseWhere } from '@/lib/oms/delivery-appointment-warehouse-where';

function appendToWhereAnd(where: Record<string, any>, clause: unknown) {
  const existing = where.AND;
  if (existing === undefined) {
    where.AND = [clause];
  } else if (Array.isArray(existing)) {
    where.AND = [...existing, clause];
  } else {
    where.AND = [existing, clause];
  }
}

function mapOutboundAppointmentFilterCondition(condition: Record<string, any>) {
  const mapped: Record<string, any> = {}

  Object.entries(condition).forEach(([fieldName, value]) => {
    if (fieldName === 'destination_location_id') {
      mapped.location_id = value
    } else if (fieldName === 'loaded_by') {
      mapped.outbound_shipments = { is: { loaded_by: value } }
    } else if (fieldName === 'trailer_code') {
      mapped.outbound_shipments = { is: { trailer_code: value } }
    } else {
      mapped[fieldName] = value
    }
  })

  return mapped
}

// GET - 获取出库管理列表（从 outbound_shipments 表查询，关联 delivery_appointments 获取其他字段）
export async function GET(request: NextRequest) {
  try {
    // 检查登录
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '100', 10)));
    const sort = searchParams.get('sort') || 'created_at';
    const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
    const search = searchParams.get('search') || '';

    // 增强配置，确保 filterFields 已生成
    const enhancedConfig = enhanceConfigWithSearchFields(outboundShipmentConfig)

    // 出库管理实际查询 delivery_appointments；先把筛选字段映射到真实表结构，再统一 AND 合并
    const filterConditions = buildFilterConditions(enhancedConfig, searchParams)
      .map((condition) => mapOutboundAppointmentFilterCondition(condition))

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
    const appointmentWhere: any = {}
    appendToWhereAnd(appointmentWhere, { delivery_method: { not: '直送' } })
    filterConditions.forEach((condition) => appendToWhereAnd(appointmentWhere, condition))
    
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
    
    // 多仓：预约可能通过主订单、明细订单、起始地或目的地归属仓库
    const currentWarehouseId = await resolveCurrentWarehouseId()
    if (currentWarehouseId != null) {
      appendToWhereAnd(
        appointmentWhere,
        buildDeliveryAppointmentWarehouseWhere(currentWarehouseId)
      )
    }

    const appointmentWhereActive = withActiveDeliveryAppointmentsWhere(appointmentWhere)

    try {
      [appointments, total] = await Promise.all([
        prisma.delivery_appointments.findMany({
          where: appointmentWhereActive,
          orderBy,
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
                  },
                },
              } as any,
            },
            appointment_detail_lines: {
              select: {
                estimated_pallets: true,
              },
            },
          },
        }),
        prisma.delivery_appointments.count({ where: appointmentWhereActive }),
      ]);
    } catch (queryError: any) {
      console.error('Prisma 查询错误:', queryError);
      console.error('查询条件:', JSON.stringify(appointmentWhere, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
      return NextResponse.json(
        {
          error: '获取出库管理列表失败',
          message: queryError.message || '数据库查询失败',
          details: process.env.NODE_ENV === 'development' ? queryError.stack : undefined,
        },
        { status: 500 }
      );
    }

    // 序列化并格式化数据
    const serializedItems = appointments.map((appointment: any, index: number) => {
      const serializedAppointment = serializeBigInt(appointment);
      // 确保 outbound_shipments 及其关联对象也被序列化
      const shipment = serializedAppointment.outbound_shipments 
        ? serializeBigInt(serializedAppointment.outbound_shipments)
        : null;
      
      // 调试：记录第一条记录的 loaded_by 相关数据
      if (index === 0) {
        const serializedShipment = shipment ? serializeBigInt(shipment) : null
        console.log(`[OutboundShipments List] 第一条记录 - loaded_by:`, serializedShipment?.loaded_by, 
          `loaded_by_name:`, serializedShipment?.users_outbound_shipments_loaded_byTousers?.username,
          `关联对象:`, serializedShipment?.users_outbound_shipments_loaded_byTousers ? JSON.stringify(serializedShipment.users_outbound_shipments_loaded_byTousers) : '不存在',
          `shipment:`, serializedShipment ? '存在' : '不存在')
      }
      
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
        // 三个 Boolean 字段（从预约中读取）
        verify_loading_sheet: serializedAppointment.verify_loading_sheet ?? false,
        can_create_sheet: serializedAppointment.can_create_sheet ?? false,
        has_created_sheet: serializedAppointment.has_created_sheet ?? false,
        
        // 从 outbound_shipments 获取的字段（已序列化）
        outbound_shipment_id: shipment?.outbound_shipment_id?.toString() || null,
        trailer_id: shipment?.trailer_id?.toString() || null,
        trailer_code: shipment?.trailer_code || null,
        loaded_by: shipment?.loaded_by?.toString() || null,
        loaded_by_name: shipment?.users_outbound_shipments_loaded_byTousers?.username || null,
        notes: shipment?.notes || null,
        delivery_address: shipment?.delivery_address || null,
        contact_name: shipment?.contact_name || null,
        contact_phone: shipment?.contact_phone || null,

        // 关联对象（用于 relation 类型字段的显示，已序列化）
        users_outbound_shipments_loaded_byTousers: shipment?.users_outbound_shipments_loaded_byTousers || null,
        
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
