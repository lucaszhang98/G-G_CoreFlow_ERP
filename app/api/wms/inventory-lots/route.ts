import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, checkPermission, handleValidationError, handleError, serializeBigInt, addSystemFields } from '@/lib/api/helpers';
import { inventoryLotCreateSchema } from '@/lib/validations/inventory-lot';
import prisma from '@/lib/prisma';

// GET - 获取库存管理列表
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
      const searchConditions: any[] = [];
      
      if (search.trim()) {
        searchConditions.push(
          { orders: { customers: { name: { contains: search } } } },
          { orders: { order_number: { contains: search } } },
          { storage_location_code: { contains: search } },
          { lot_number: { contains: search } }
        );
      }
      
      if (searchConditions.length > 0) {
        where.OR = searchConditions;
      }
    }

    // 排序
    const orderBy: any = {};
    if (sort === 'container_number') {
      orderBy.orders = { order_number: order };
    } else if (sort === 'customer_name' || sort === 'planned_unload_at' || sort === 'delivery_location' || sort === 'delivery_nature') {
      orderBy.created_at = 'desc';
    } else {
      orderBy[sort] = order;
    }

    // 查询数据
    let items: any[];
    let total: number;
    
    try {
      // 检查 Prisma 客户端是否有 inventory_lots 模型
      if (!prisma.inventory_lots) {
        throw new Error('Prisma 客户端未找到 inventory_lots 模型，请运行 npx prisma generate');
      }

      const includeConfig = {
        orders: {
          select: {
            order_id: true,
            order_number: true,
            container_number: true,
            order_date: true,
            delivery_location: true,
            customers: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        order_detail: {
          select: {
            id: true,
            quantity: true,
            volume: true,
            estimated_pallets: true,
            delivery_nature: true,
          },
        },
        inbound_receipt: {
          select: {
            inbound_receipt_id: true,
            planned_unload_at: true,
            delivery_progress: true,
          },
        },
        warehouses: {
          select: {
            warehouse_id: true,
            name: true,
            warehouse_code: true,
          },
        },
      };

      [items, total] = await Promise.all([
        prisma.inventory_lots.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
          include: includeConfig,
        }),
        prisma.inventory_lots.count({ where }),
      ]);
    } catch (dbError: any) {
      console.error('数据库查询失败:', dbError);
      if (dbError.message) {
        console.error('错误信息:', dbError.message);
      }
      if (dbError.stack) {
        console.error('错误堆栈:', dbError.stack);
      }
      throw new Error(`数据库查询失败: ${dbError.message || '未知错误'}`);
    }

    // 转换数据格式，添加关联字段
    const serializedItems = items.map((item: any) => {
      try {
        const serialized = serializeBigInt(item);
        const order = serialized.orders;
        const orderDetail = serialized.order_detail;
        const inboundReceipt = serialized.inbound_receipt;
        
        // 客户名称
        const customerName = order?.customers?.name || null;
        
        // 柜号使用订单号
        const containerNumber = order?.order_number || null;
        
        // 预计拆柜日期
        const plannedUnloadAt = inboundReceipt?.planned_unload_at || null;
        
        // 送仓地点（仓点）
        const deliveryLocation = order?.delivery_location || null;
        
        // 送仓性质
        const deliveryNature = orderDetail?.delivery_nature || null;
        
        // 送货进度（优先使用inventory_lots表的，如果没有则从inbound_receipt获取）
        const deliveryProgress = serialized.delivery_progress !== null && serialized.delivery_progress !== undefined
          ? serialized.delivery_progress
          : inboundReceipt?.delivery_progress || null;

        return {
          ...serialized,
          customer_name: customerName,
          container_number: containerNumber,
          planned_unload_at: plannedUnloadAt,
          delivery_location: deliveryLocation,
          delivery_nature: deliveryNature,
          delivery_progress: deliveryProgress,
          warehouse_name: serialized.warehouses?.name || null,
        };
      } catch (itemError: any) {
        console.error('序列化数据项失败:', itemError, item);
        return {
          ...serializeBigInt(item),
          customer_name: null,
          container_number: null,
          planned_unload_at: null,
          delivery_location: null,
          delivery_nature: null,
          delivery_progress: null,
          warehouse_name: null,
        };
      }
    });

    return NextResponse.json({
      data: serializedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return handleError(error, '获取库存管理列表失败');
  }
}

// POST - 创建库存管理记录
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 验证输入
    const validationResult = inventoryLotCreateSchema.safeParse(body);
    if (!validationResult.success) {
      return handleValidationError(validationResult.error);
    }

    const data = validationResult.data;

    // 检查订单是否存在
    const existingOrder = await prisma.orders.findUnique({
      where: { order_id: BigInt(data.order_id) },
    });
    if (!existingOrder) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 });
    }

    // 检查订单明细是否存在
    const existingOrderDetail = await prisma.order_detail.findUnique({
      where: { id: BigInt(data.order_detail_id) },
    });
    if (!existingOrderDetail) {
      return NextResponse.json({ error: '订单明细不存在' }, { status: 404 });
    }

    // 检查仓库是否存在
    const warehouse = await prisma.warehouses.findUnique({
      where: { warehouse_id: BigInt(data.warehouse_id) },
    });
    if (!warehouse) {
      return NextResponse.json({ error: '仓库不存在' }, { status: 404 });
    }

    // 构建创建数据
    const createData: any = {
      order_id: BigInt(data.order_id),
      order_detail_id: BigInt(data.order_detail_id),
      warehouse_id: BigInt(data.warehouse_id),
      storage_location_code: data.storage_location_code || null,
      pallet_count: data.pallet_count || 1,
      remaining_pallet_count: data.remaining_pallet_count ?? 0,
      unbooked_pallet_count: data.unbooked_pallet_count ?? 0,
      delivery_progress: data.delivery_progress ? Number(data.delivery_progress) : null,
      unload_transfer_notes: data.unload_transfer_notes || null,
      notes: data.notes || null,
      status: data.status || 'available',
      lot_number: data.lot_number || null,
      received_date: data.received_date ? new Date(data.received_date) : null,
    };

    if (data.inbound_receipt_id) {
      createData.inbound_receipt_id = BigInt(data.inbound_receipt_id);
    }

    // 获取当前用户
    const authResult = await checkAuth();
    if (authResult.error) {
      return authResult.error;
    }
    const currentUser = authResult.user;
    if (!currentUser) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    // 应用审计字段
    addSystemFields(createData, currentUser, true);

    // 创建记录
    const newItem = await prisma.inventory_lots.create({
      data: createData,
      include: {
        orders: {
          select: {
            order_id: true,
            order_number: true,
            container_number: true,
            order_date: true,
            delivery_location: true,
            customers: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        order_detail: {
          select: {
            id: true,
            quantity: true,
            volume: true,
            estimated_pallets: true,
            delivery_nature: true,
          },
        },
        inbound_receipt: {
          select: {
            inbound_receipt_id: true,
            planned_unload_at: true,
            delivery_progress: true,
          },
        },
        warehouses: {
          select: {
            warehouse_id: true,
            name: true,
            warehouse_code: true,
          },
        },
      },
    });

    const serialized = serializeBigInt(newItem);
    const order = serialized.orders;
    const orderDetail = serialized.order_detail;
    const inboundReceipt = serialized.inbound_receipt;

    return NextResponse.json({
      data: {
        ...serialized,
        customer_name: order?.customers?.name || null,
        container_number: order?.order_number || null,
        planned_unload_at: inboundReceipt?.planned_unload_at || null,
        delivery_location: order?.delivery_location || null,
        delivery_nature: orderDetail?.delivery_nature || null,
        delivery_progress: serialized.delivery_progress !== null && serialized.delivery_progress !== undefined
          ? serialized.delivery_progress
          : inboundReceipt?.delivery_progress || null,
        warehouse_name: serialized.warehouses?.name || null,
      },
    }, { status: 201 });
  } catch (error: any) {
    return handleError(error, '创建库存管理记录失败');
  }
}

