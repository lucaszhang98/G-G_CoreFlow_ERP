import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, checkPermission, handleValidationError, handleError, serializeBigInt, addSystemFields } from '@/lib/api/helpers';
import { inventoryLotCreateSchema } from '@/lib/validations/inventory-lot';
import prisma from '@/lib/prisma';
import { inventoryLotConfig } from '@/lib/crud/configs/inventory-lots';
import { buildFilterConditions, mergeFilterConditions } from '@/lib/crud/filter-helper';
import { enhanceConfigWithSearchFields } from '@/lib/crud/search-config-generator';

// GET - 获取库存管理列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const sort = searchParams.get('sort') || 'created_at';
    const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
    const search = searchParams.get('search') || '';

    // 增强配置，确保 filterFields 已生成
    const enhancedConfig = enhanceConfigWithSearchFields(inventoryLotConfig)

    // 构建查询条件
    // 只显示已入库的数据：已填位置和板数，且关联的入库管理状态为'received'
    const where: any = {
      storage_location_code: {
        not: null,
      },
      pallet_count: {
        gt: 0, // 板数必须大于0
      },
      // 只显示已入库的数据（inbound_receipt.status = 'received'）
      inbound_receipt: {
        status: 'received',
      },
    };

    // 使用统一的筛选逻辑
    const filterConditions = buildFilterConditions(enhancedConfig, searchParams)
    
    // 分离主表字段和关联表字段的筛选条件
    const mainTableConditions: any[] = []
    const ordersConditions: any = {}
    const orderDetailConditions: any = {}
    
    filterConditions.forEach((condition) => {
      Object.keys(condition).forEach((fieldName) => {
        // 判断字段是否来自 order_detail 表
        // order_detail 字段：delivery_nature, delivery_location_id
        if (fieldName === 'delivery_nature' || fieldName === 'delivery_location' || fieldName === 'delivery_location_id') {
          Object.assign(orderDetailConditions, condition)
        }
        // 判断字段是否来自主表
        // 主表字段：lot_id, inbound_receipt_id, order_detail_id, storage_location_code, pallet_count, notes, remaining_pallet_count, unbooked_pallet_count, delivery_progress
        else if (['lot_id', 'inbound_receipt_id', 'order_detail_id', 'storage_location_code', 'pallet_count', 'notes', 'remaining_pallet_count', 'unbooked_pallet_count', 'delivery_progress'].includes(fieldName)) {
          mainTableConditions.push(condition)
        } else {
          // 字段来自 orders 表
          Object.assign(ordersConditions, condition)
        }
      })
    })
    
    // 合并主表筛选条件
    if (mainTableConditions.length > 0) {
      mergeFilterConditions(where, mainTableConditions)
    }
    
    // 合并 orders 表的筛选条件
    if (Object.keys(ordersConditions).length > 0) {
      if (where.orders) {
        where.orders = {
          ...where.orders,
          ...ordersConditions,
        }
      } else {
        where.orders = ordersConditions
      }
    }
    
    // 合并 order_detail 表的筛选条件
    if (Object.keys(orderDetailConditions).length > 0) {
      where.order_detail = {
        is: orderDetailConditions
      }
    }

    // 搜索条件
    if (search && search.trim()) {
      const searchConditions: any[] = [
        { orders: { customers: { name: { contains: search } } } },
        { orders: { order_number: { contains: search } } },
        { storage_location_code: { contains: search } }
      ];
      
      // 使用 AND 条件：必须满足 storage_location_code 不为空，并且满足搜索条件
      where.AND = [
        { storage_location_code: { not: null } },
        { OR: searchConditions }
      ];
    }

    // 排序
    const orderBy: any = {};
    if (sort === 'container_number') {
      orderBy.orders = { order_number: order };
    } else if (sort === 'customer_name') {
      orderBy.orders = { customers: { name: order } };
    } else if (sort === 'planned_unload_at') {
      orderBy.inbound_receipt = { planned_unload_at: order };
    } else if (sort === 'delivery_location') {
      orderBy.order_detail = { locations_order_detail_delivery_location_idTolocations: { location_code: order } };
    } else if (sort === 'delivery_nature') {
      orderBy.order_detail = { delivery_nature: order };
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
            order_date: true,
            delivery_appointments: {
              select: {
                appointment_id: true,
                reference_number: true,
                confirmed_start: true,
                location_id: true,
                status: true,
              },
            },
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
          delivery_location_id: true,
          locations_order_detail_delivery_location_idTolocations: {
            select: {
              location_id: true,
              location_code: true,
              name: true,
            },
          },
          appointment_detail_lines: {
              select: {
                id: true,
                estimated_pallets: true,
                appointment_id: true,
                delivery_appointments: {
                  select: {
                    appointment_id: true,
                    reference_number: true,
                    confirmed_start: true,
                    location_id: true,
                    status: true,
                    order_id: true,
                  },
                },
              },
            },
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
          select: {
            inventory_lot_id: true,
            warehouse_id: true,
            storage_location_code: true,
            status: true,
            // notes 字段在数据库中不存在，所以不查询
            order_id: true,
            order_detail_id: true,
            created_at: true,
            updated_at: true,
            created_by: true,
            updated_by: true,
            inbound_receipt_id: true,
            lot_number: true,
            received_date: true,
            pallet_count: true,
            remaining_pallet_count: true,
            unbooked_pallet_count: true,
            delivery_progress: true,
            orders: {
              select: {
                order_id: true,
                order_number: true,
                order_date: true,
                delivery_appointments: {
                  select: {
                    appointment_id: true,
                    reference_number: true,
                    confirmed_start: true,
                    location_id: true,
                    status: true,
                  },
                },
                customers: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
              },
            },
            order_detail: includeConfig.order_detail,
            inbound_receipt: includeConfig.inbound_receipt,
            warehouses: includeConfig.warehouses,
          },
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

    // delivery_location_id 现在有外键约束，关联数据通过 Prisma include 自动加载
    // 不需要手动查询 locations 了

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
        
        // 送仓地点（仓点）- 从 order_detail 关联数据获取 location_code
        const deliveryLocation = orderDetail?.locations_order_detail_delivery_location_idTolocations?.location_code || null
        
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

    const orderDetailId = BigInt(data.order_detail_id);
    const palletCount = data.pallet_count || 1;

    // 获取所有预约的预计板数之和（用于计算未约板数）
    const appointmentLines = await prisma.appointment_detail_lines.findMany({
      where: { order_detail_id: orderDetailId },
      select: { estimated_pallets: true },
    });
    const totalAppointmentPallets = appointmentLines.reduce((sum, line) => {
      return sum + (line.estimated_pallets || 0);
    }, 0);

    // 获取所有未过期预约的预计板数之和（用于计算剩余板数）
    // 判断过期：confirmed_start < 当前日期
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiredAppointmentLines = await prisma.appointment_detail_lines.findMany({
      where: {
        order_detail_id: orderDetailId,
        delivery_appointments: {
          confirmed_start: {
            lt: today,
          },
        },
      },
      select: { estimated_pallets: true },
    });
    const totalExpiredAppointmentPallets = expiredAppointmentLines.reduce((sum, line) => {
      return sum + (line.estimated_pallets || 0);
    }, 0);

    // 计算未约板数和剩余板数
    const unbookedPalletCount = palletCount - totalAppointmentPallets; // 实际板数 - 所有预约的板数
    const remainingPalletCount = palletCount - totalExpiredAppointmentPallets; // 实际板数 - 已过期预约的板数

    // 构建创建数据
    const createData: any = {
      order_id: BigInt(data.order_id),
      order_detail_id: orderDetailId,
      warehouse_id: BigInt(data.warehouse_id),
      storage_location_code: data.storage_location_code || null,
      pallet_count: palletCount,
      remaining_pallet_count: remainingPalletCount, // 自动计算
      unbooked_pallet_count: unbookedPalletCount, // 自动计算
      delivery_progress: data.delivery_progress ? Number(data.delivery_progress) : null,
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
    await addSystemFields(createData, currentUser, true);

    // 创建记录
    const newItem = await prisma.inventory_lots.create({
      data: createData,
      select: {
        inventory_lot_id: true,
        warehouse_id: true,
        storage_location_code: true,
        status: true,
        // notes 字段在数据库中不存在，所以不查询
        order_id: true,
        order_detail_id: true,
        created_at: true,
        updated_at: true,
        created_by: true,
        updated_by: true,
        inbound_receipt_id: true,
        lot_number: true,
        received_date: true,
        pallet_count: true,
        remaining_pallet_count: true,
        unbooked_pallet_count: true,
        delivery_progress: true,
        orders: {
          select: {
            order_id: true,
            order_number: true,
            order_date: true,
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
            delivery_location_id: true,
            locations_order_detail_delivery_location_idTolocations: {
              select: {
                location_id: true,
                location_code: true,
                name: true,
              },
            },
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
        delivery_location: orderDetail?.locations_order_detail_delivery_location_idTolocations?.location_code || null,
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

