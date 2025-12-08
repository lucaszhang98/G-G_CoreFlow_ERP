import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, handleValidationError, handleError, serializeBigInt, addSystemFields } from '@/lib/api/helpers';
import { deliveryAppointmentCreateSchema } from '@/lib/validations/delivery-appointment';
import prisma from '@/lib/prisma';

// GET - 获取预约管理列表
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

    // 构建查询条件
    const where: any = {};

    // 搜索条件
    if (search) {
      const searchConditions: any[] = [
        { reference_number: { contains: search } },
        { notes: { contains: search } },
      ];
      
      where.OR = searchConditions;
    }

    // 排序
    const orderBy: any = {};
    if (sort === 'appointment_type' || sort === 'total_pallets') {
      // 这些字段来自关联表或计算字段，先按创建时间排序
      orderBy.created_at = 'desc';
    } else {
      orderBy[sort] = order;
    }

    // 构建 include 对象
    // 注意：预约明细现在从 appointment_detail_lines 读取
    const includeConfig: any = {
      orders: {
        select: {
          order_id: true,
          order_number: true,
          delivery_location: true,
        },
      },
      locations: {
        select: {
          location_id: true,
          name: true,
          location_code: true,
        },
      },
      locations_delivery_appointments_origin_location_idTolocations: {
        select: {
          location_id: true,
          name: true,
          location_code: true,
        },
      },
      appointment_detail_lines: {
        select: {
          estimated_pallets: true,
        },
      },
    };

    // 查询数据
    let items: any[] = [];
    let total = 0;
    
    try {
      [items, total] = await Promise.all([
        prisma.delivery_appointments.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
          include: includeConfig,
        }),
        prisma.delivery_appointments.count({ where }),
      ]);
    } catch (queryError: any) {
      console.error('Prisma 查询错误:', queryError);
      console.error('错误详情:', {
        message: queryError.message,
        code: queryError.code,
        meta: queryError.meta,
      });
      
      // 如果是因为关联不存在，尝试简化查询
      if (queryError.message?.includes('Unknown field') || queryError.message?.includes('Available options')) {
        console.log('尝试简化查询（移除可能不存在的关联）');
        // 移除可能有问题的关联，但保留 appointment_detail_lines
        const simplifiedInclude: any = {
          orders: {
            select: {
              order_id: true,
              order_number: true,
              delivery_location: true,
            },
          },
          locations: {
            select: {
              location_id: true,
              name: true,
              location_code: true,
            },
          },
          appointment_detail_lines: {
            select: {
              estimated_pallets: true,
            },
          },
        };
        
        [items, total] = await Promise.all([
          prisma.delivery_appointments.findMany({
            where,
            orderBy,
            skip: (page - 1) * limit,
            take: limit,
            include: simplifiedInclude,
          }),
          prisma.delivery_appointments.count({ where }),
        ]);
      } else {
        throw queryError;
      }
    }

    // 序列化并格式化数据
    // 注意：outbound_shipment_lines 表已被删除，total_pallets 现在从 order_detail.estimated_pallets 计算
    
    // 格式化数据
    const serializedItems = items.map((item: any) => {
      const serialized = serializeBigInt(item);
      
      // 预约号码
      const referenceNumber = serialized.reference_number || null;
      
      // 派送方式、预约账号、预约类型直接从 delivery_appointments 表获取
      // 如果字段不存在，使用 null（数据库可能还没有这些字段）
      const deliveryMethod = serialized.delivery_method || null;
      const appointmentAccount = serialized.appointment_account || null;
      // 直接使用 appointment_type 字段
      const appointmentType = serialized.appointment_type || null;
      
      // 起始地（从关联的 locations 获取）
      // 返回location_id用于表单，同时返回location_code用于显示
      const originLocationId = serialized.origin_location_id || null;
      const originLocationCode = serialized.locations_delivery_appointments_origin_location_idTolocations?.location_code || null;
      
      // 目的地（从关联的 locations 获取）
      const destinationLocationId = serialized.location_id || null;
      const destinationLocationCode = serialized.locations?.location_code || null;
      
      // 送货时间
      const confirmedStart = serialized.confirmed_start || null;
      
      // 计算板数：从 appointment_detail_lines.estimated_pallets 累加
      let totalPallets = 0
      if (serialized.appointment_detail_lines && Array.isArray(serialized.appointment_detail_lines)) {
        totalPallets = serialized.appointment_detail_lines.reduce((sum: number, line: any) => {
          const pallets = line.estimated_pallets
          const numPallets = typeof pallets === 'number' ? pallets : (pallets ? Number(pallets) : 0)
          return sum + (isNaN(numPallets) ? 0 : numPallets)
        }, 0)
      }
      
      // 调试日志
      console.log(`[appointments/route] 预约 ${serialized.appointment_id || serialized.reference_number}: appointment_detail_lines数量=${serialized.appointment_detail_lines?.length || 0}, totalPallets=${totalPallets}`)
      if (serialized.appointment_detail_lines && serialized.appointment_detail_lines.length > 0) {
        console.log(`[appointments/route] 明细行数据:`, serialized.appointment_detail_lines.map((line: any) => ({
          estimated_pallets: line.estimated_pallets,
          type: typeof line.estimated_pallets
        })))
      }
      
      // 备注
      const notes = serialized.notes || null;
      
      // 拒收字段
      const rejected = serialized.rejected ?? false;

      return {
        ...serialized,
        reference_number: referenceNumber,
        delivery_method: deliveryMethod,
        appointment_account: appointmentAccount,
        appointment_type: appointmentType,
        // 返回location_id用于表单字段绑定
        origin_location_id: originLocationId,
        location_id: destinationLocationId,
        // 返回location_code用于列表显示（而不是name）
        origin_location: originLocationCode,
        destination_location: destinationLocationCode,
        confirmed_start: confirmedStart,
        total_pallets: totalPallets, // 从 order_detail.estimated_pallets 计算
        rejected: rejected,
        notes: notes,
        // 保留 orders 对象，用于展开行获取 order_detail
        orders: serialized.orders || null,
      };
    });

    return NextResponse.json({
      data: serializedItems,
      total,
      page,
      limit,
    });
  } catch (error: any) {
    console.error('获取预约管理列表失败:', error);
    console.error('错误详情:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      meta: error.meta,
      name: error.name,
    });
    return NextResponse.json(
      {
        error: '获取预约管理列表失败',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? {
          code: error.code,
          meta: error.meta,
          stack: error.stack,
        } : undefined,
      },
      { status: 500 }
    );
  }
}

// POST - 创建预约管理记录
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 验证输入
    const validationResult = deliveryAppointmentCreateSchema.safeParse(body);
    if (!validationResult.success) {
      return handleValidationError(validationResult.error);
    }

    const data = validationResult.data;
    
    // 检查登录
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;
    
    // 获取当前用户（用于审计字段）
    const currentUser = authResult;

    // 构建创建数据
    const createData: any = {
      reference_number: data.reference_number || null,
      order_id: data.order_id ? (typeof data.order_id === 'bigint' ? data.order_id : BigInt(data.order_id)) : null,
      location_id: data.location_id ? (typeof data.location_id === 'bigint' ? data.location_id : BigInt(data.location_id)) : null,
      origin_location_id: data.origin_location_id ? (typeof data.origin_location_id === 'bigint' ? data.origin_location_id : BigInt(data.origin_location_id)) : null,
      appointment_type: data.appointment_type || null,
      delivery_method: data.delivery_method || null,
      appointment_account: data.appointment_account || null,
      requested_start: data.requested_start ? new Date(data.requested_start) : null,
      requested_end: data.requested_end ? new Date(data.requested_end) : null,
      confirmed_start: data.confirmed_start ? new Date(data.confirmed_start) : null,
      confirmed_end: data.confirmed_end ? new Date(data.confirmed_end) : null,
      status: data.status || 'requested',
      rejected: data.rejected !== undefined ? Boolean(data.rejected) : false,
      notes: data.notes || null,
    };

    // 应用系统字段
    const user = currentUser.user || null;
    const finalData = await addSystemFields(createData, user, true);

    // 创建记录
    const newItem = await prisma.delivery_appointments.create({
      data: finalData,
    });

    const serialized = serializeBigInt(newItem);
    
    // 如果是非直送预约，自动创建 outbound_shipments 记录
    if (finalData.delivery_method && finalData.delivery_method !== '直送') {
      try {
        // 获取默认 warehouse_id（使用第一个可用的 warehouse_id，或使用 1000 作为默认值）
        const defaultWarehouseId = BigInt(1000);
        const appointmentId = serialized.appointment_id;
        
        // 使用原始 SQL 插入，避免 Prisma 类型问题
        // 确保 appointmentId 是 BigInt 类型
        const appointmentIdBigInt = BigInt(appointmentId);
        await prisma.$executeRaw`
          INSERT INTO wms.outbound_shipments (warehouse_id, appointment_id, status, created_at, updated_at, created_by, updated_by)
          VALUES (${defaultWarehouseId}, ${appointmentIdBigInt}, 'planned', NOW(), NOW(), ${user?.id ? BigInt(user.id) : null}, ${user?.id ? BigInt(user.id) : null})
          ON CONFLICT (appointment_id) DO NOTHING
        `;
      } catch (outboundError: any) {
        // 如果创建失败（例如已存在），记录错误但不影响预约创建
        console.warn('自动创建 outbound_shipments 记录失败:', outboundError);
      }
    }
    
    // 新建时，total_pallets默认为0（因为还没有outbound_shipment_lines）
    return NextResponse.json({
      ...serialized,
      total_pallets: 0,
    }, { status: 201 });
  } catch (error: any) {
    console.error('创建预约管理记录失败:', error);
    return handleError(error);
  }
}

