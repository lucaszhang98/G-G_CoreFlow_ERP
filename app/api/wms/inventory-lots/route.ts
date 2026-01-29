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
    const permissionResult = await checkPermission(inventoryLotConfig.permissions.list);
    if (permissionResult.error) return permissionResult.error;

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
    const inboundReceiptConditions: any = {}
    
    filterConditions.forEach((condition) => {
      // 检查条件是否包含 OR 或 AND（复合条件）
      // 如果是复合条件，需要检查内部字段来判断属于哪个表
      if (condition.OR || condition.AND) {
        // 复合条件：需要检查内部字段
        const nestedConditions = condition.OR || condition.AND || []
        let belongsToMainTable = false
        let belongsToOrderDetail = false
        let belongsToInboundReceipt = false
        
        // 递归检查嵌套条件中的字段
        const checkNestedCondition = (cond: any) => {
          if (!cond || typeof cond !== 'object') return
          Object.keys(cond).forEach((fieldName) => {
            if (fieldName === 'delivery_nature' || fieldName === 'delivery_location_id') {
              belongsToOrderDetail = true
            } else if (fieldName === 'planned_unload_at') {
              belongsToInboundReceipt = true
            } else if (['lot_id', 'inbound_receipt_id', 'order_detail_id', 'storage_location_code', 'pallet_count', 'notes', 'remaining_pallet_count', 'unbooked_pallet_count'].includes(fieldName)) {
              belongsToMainTable = true
            } else if (fieldName === 'delivery_progress') {
              // delivery_progress 是实时计算的，不在数据库筛选，稍后在内存中筛选
              // 跳过这个条件，不添加到任何表
            } else if (cond[fieldName] && typeof cond[fieldName] === 'object') {
              // 递归检查嵌套对象（如 { not: { equals: 100 } }）
              checkNestedCondition(cond[fieldName])
            }
          })
        }
        
        nestedConditions.forEach((nestedCond: any) => {
          checkNestedCondition(nestedCond)
        })
        
        // 根据字段归属决定将条件添加到哪个表
        if (belongsToMainTable) {
          mainTableConditions.push(condition)
        } else if (belongsToOrderDetail) {
          // 对于复合条件，不能直接 Object.assign，需要特殊处理
          // 但 delivery_nature 和 delivery_location_id 通常不会出现在复合条件中
          Object.assign(orderDetailConditions, condition)
        } else if (belongsToInboundReceipt) {
          Object.assign(inboundReceiptConditions, condition)
        } else {
          // 默认作为主表条件（可能是 delivery_progress 的 OR 条件）
          mainTableConditions.push(condition)
        }
      } else {
        // 普通条件：按字段名分类
        Object.keys(condition).forEach((fieldName) => {
          // 跳过 OR 和 AND 关键字（这些不应该出现在普通条件中，但为了安全起见）
          if (fieldName === 'OR' || fieldName === 'AND') {
            return
          }
          // 判断字段是否来自 order_detail 表
          // order_detail 字段：delivery_nature, delivery_location_id（relation 筛选会返回 delivery_location_id，因为配置了 relationField）
          if (fieldName === 'delivery_nature' || fieldName === 'delivery_location_id') {
            Object.assign(orderDetailConditions, condition)
          }
          // 判断字段是否来自 inbound_receipt 表
          // inbound_receipt 字段：planned_unload_at
          else if (fieldName === 'planned_unload_at') {
            Object.assign(inboundReceiptConditions, condition)
          }
          // 判断字段是否来自主表
          // 主表字段：lot_id, inbound_receipt_id, order_detail_id, storage_location_code, pallet_count, notes, remaining_pallet_count, unbooked_pallet_count
          // 注意：delivery_progress 是实时计算的，不在数据库筛选，稍后在内存中筛选
          else if (fieldName === 'delivery_progress') {
            // delivery_progress 是实时计算的，不在数据库筛选，稍后在内存中筛选
            // 跳过这个条件，不添加到任何表
          } else if (['lot_id', 'inbound_receipt_id', 'order_detail_id', 'storage_location_code', 'pallet_count', 'notes', 'remaining_pallet_count', 'unbooked_pallet_count'].includes(fieldName)) {
            mainTableConditions.push(condition)
          } else {
            // 字段来自 orders 表
            Object.assign(ordersConditions, condition)
          }
        })
      }
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
    
    // 合并 inbound_receipt 表的筛选条件
    if (Object.keys(inboundReceiptConditions).length > 0) {
      // 需要与默认的 status: 'received' 条件合并，而不是覆盖
      where.inbound_receipt = {
        is: {
          status: 'received',
          ...inboundReceiptConditions,
        }
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
    } else if (sort) {
      // 确保 sort 字段存在且有效
      orderBy[sort] = order;
    } else {
      // 默认排序
      orderBy.created_at = 'desc';
    }

    // 检查是否有 delivery_progress 筛选（需要内存筛选）
    // 需要在查询之前定义，以便在后续代码中使用
    const deliveryProgressFilter = searchParams.get('filter_delivery_progress');
    const needsMemoryFilter = deliveryProgressFilter && deliveryProgressFilter !== '__all__';

    // 查询数据
    let items: any[];
    let total: number;
    
    // 构建查询选项（需要在 try 块外部定义，以便在 catch 块中访问）
    const queryOptions: any = {
      where,
      orderBy,
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
                rejected_pallets: true,
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
              } as import('@prisma/client').Prisma.appointment_detail_linesSelect,
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
    };
    
    if (!needsMemoryFilter) {
      // 没有 delivery_progress 筛选，正常分页查询
      queryOptions.skip = (page - 1) * limit;
      queryOptions.take = limit;
    }
    // 如果有 delivery_progress 筛选，不应用分页，稍后在内存中筛选和分页
    
    try {
      // 检查 Prisma 客户端是否有 inventory_lots 模型
      if (!prisma.inventory_lots) {
        throw new Error('Prisma 客户端未找到 inventory_lots 模型，请运行 npx prisma generate');
      }
      
      [items, total] = await Promise.all([
        prisma.inventory_lots.findMany(queryOptions),
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
      if (process.env.NODE_ENV === 'development') {
        console.error('查询选项:', JSON.stringify(queryOptions, null, 2));
        console.error('Where 条件:', JSON.stringify(where, null, 2));
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
        
        // 送货进度：对于库存管理，需要实时计算（基于 pallet_count 和 remaining_pallet_count）
        // 公式：delivery_progress = (pallet_count - remaining_pallet_count) / pallet_count * 100
        let deliveryProgress = null;
        const palletCount = serialized.pallet_count ?? 0;
        const remainingCount = serialized.remaining_pallet_count ?? 0;
        
        if (palletCount > 0) {
          const deliveredCount = palletCount - remainingCount;
          deliveryProgress = (deliveredCount / palletCount) * 100;
          deliveryProgress = Math.round(deliveryProgress * 100) / 100; // 保留两位小数
          deliveryProgress = Math.max(0, Math.min(100, deliveryProgress)); // 确保在 0-100 之间
        } else if (palletCount === 0) {
          // 如果实际板数为0，视为已送完（100%）
          deliveryProgress = 100;
        }

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

    // 在内存中根据 delivery_progress 筛选（因为 delivery_progress 是实时计算的，不能基于数据库字段筛选）
    let filteredItems = serializedItems;
    let filteredTotal = total;
    
    if (needsMemoryFilter) {
      if (deliveryProgressFilter === 'complete') {
        // 已完成：delivery_progress >= 100
        filteredItems = serializedItems.filter((item: any) => {
          const progress = item.delivery_progress;
          return progress !== null && progress !== undefined && progress >= 100;
        });
        filteredTotal = filteredItems.length;
      } else if (deliveryProgressFilter === 'incomplete') {
        // 未完成：delivery_progress < 100 或为 null
        filteredItems = serializedItems.filter((item: any) => {
          const progress = item.delivery_progress;
          return progress === null || progress === undefined || progress < 100;
        });
        filteredTotal = filteredItems.length;
      }
      
      // 应用分页（在内存筛选后）
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      filteredItems = filteredItems.slice(startIndex, endIndex);
    }
    // 如果没有 delivery_progress 筛选，serializedItems 已经是分页后的数据，直接使用

    return NextResponse.json({
      data: filteredItems,
      pagination: {
        page,
        limit,
        total: needsMemoryFilter ? filteredTotal : total,
        totalPages: Math.ceil((needsMemoryFilter ? filteredTotal : total) / limit),
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

    const appointmentLines = await prisma.appointment_detail_lines.findMany({
      where: { order_detail_id: orderDetailId },
      select: { estimated_pallets: true, rejected_pallets: true, delivery_appointments: { select: { confirmed_start: true } } },
    });
    const effective = (est: number, rej?: number | null) => (est || 0) - (rej ?? 0);
    const totalEffectivePallets = appointmentLines.reduce((sum, line) => sum + effective(line.estimated_pallets, line.rejected_pallets), 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const totalExpiredEffectivePallets = appointmentLines.reduce((sum, line) => {
      const start = line.delivery_appointments?.confirmed_start;
      if (!start) return sum;
      const d = new Date(start);
      d.setHours(0, 0, 0, 0);
      return d < today ? sum + effective(line.estimated_pallets, line.rejected_pallets) : sum;
    }, 0);
    const unbookedPalletCount = palletCount - totalEffectivePallets;
    const remainingPalletCount = palletCount - totalExpiredEffectivePallets;

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

