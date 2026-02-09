import { NextRequest, NextResponse } from 'next/server';
import { createListHandler } from '@/lib/crud/api-handler';
import { inboundReceiptConfig } from '@/lib/crud/configs/inbound-receipts';
import { checkPermission, handleValidationError, handleError, serializeBigInt, addSystemFields } from '@/lib/api/helpers';
import { inboundReceiptCreateSchema } from '@/lib/validations/inbound-receipt';
import prisma from '@/lib/prisma';
import { buildFilterConditions, mergeFilterConditions } from '@/lib/crud/filter-helper';
import { enhanceConfigWithSearchFields } from '@/lib/crud/search-config-generator';
import { calculateUnloadDate } from '@/lib/utils/calculate-unload-date';

// GET - 获取拆柜规划列表（使用统一框架，但需要自定义处理关联数据）
export async function GET(request: NextRequest) {
  try {
    const permissionResult = await checkPermission(inboundReceiptConfig.permissions.list);
    if (permissionResult.error) return permissionResult.error;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const sort = searchParams.get('sort') || 'created_at';
    const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
    const search = searchParams.get('search') || '';

    // 增强配置，确保 filterFields 已生成
    const enhancedConfig = enhanceConfigWithSearchFields(inboundReceiptConfig)

    // 构建查询条件（只查询入库单表，不查询订单表）
    // 入库单应该只关联操作方式为"拆柜"的订单，这个关联关系在入库单创建时已经保证
    const where: any = {
      // 只显示关联订单操作方式为"拆柜"的入库单
      orders: {
        operation_mode: 'unload',
      },
    }

    // 使用统一的筛选逻辑
    const filterConditions = buildFilterConditions(enhancedConfig, searchParams)
    
    // 分离主表字段和关联表字段的筛选条件
    const mainTableConditions: any[] = []
    const ordersConditions: any = {}
    
    filterConditions.forEach((condition) => {
      // 整条 condition 若包含 delivery_progress（含 OR: [{ delivery_progress: ... }] 形式），不参与主表/orders 合并，由下面单独用 inventory_lots 处理
      const hasDeliveryProgress = (obj: any): boolean => {
        if (!obj || typeof obj !== 'object') return false
        if ('delivery_progress' in obj) return true
        return Object.values(obj).some((v) => hasDeliveryProgress(v))
      }
      if (hasDeliveryProgress(condition)) return

      Object.keys(condition).forEach((fieldName) => {
        const mainTableFields = ['inbound_receipt_id', 'order_id', 'status', 'planned_unload_at', 'unloaded_by', 'received_by', 'notes']
        if (mainTableFields.includes(fieldName)) {
          mainTableConditions.push(condition)
        } else {
          Object.assign(ordersConditions, condition)
        }
      })
    })

    // 送仓进度筛选：按「送货进度」字段是否 100% 区分。已完成=该字段为 100%，未完成=该字段不是 100%
    // 100% 仅当：有明细且所有明细 remaining_pallet_count=0；非 100%=无明细 或 存在 remaining>0 或 null
    const filterDeliveryProgress = searchParams.get('filter_delivery_progress')
    if (filterDeliveryProgress === 'complete' || filterDeliveryProgress === 'incomplete') {
      where.AND = where.AND || []
      if (filterDeliveryProgress === 'complete') {
        // 已完成：送货进度 100% = 有明细且所有明细剩余板数均为 0
        where.AND.push({
          AND: [
            { inventory_lots: { some: {} } },
            { inventory_lots: { every: { remaining_pallet_count: 0 } } },
          ],
        })
      } else {
        // 未完成：送货进度不是 100% = 无明细 或 至少有一条 remaining > 0 或 null
        where.AND.push({
          OR: [
            { inventory_lots: { none: {} } },
            {
              inventory_lots: {
                some: {
                  OR: [
                    { remaining_pallet_count: { gt: 0 } },
                    { remaining_pallet_count: null },
                  ],
                },
              },
            },
          ],
        })
      }
    }
    
    // 合并主表筛选条件
    if (mainTableConditions.length > 0) {
      mergeFilterConditions(where, mainTableConditions)
    }

    // 「显示最近一月」：仅设置了拆柜日期起、未设止时，包含“未填拆柜日期”的记录
    const plannedFrom = searchParams.get('filter_planned_unload_at_from')
    const plannedTo = searchParams.get('filter_planned_unload_at_to')
    if (plannedFrom && !plannedTo && where.planned_unload_at?.gte && where.planned_unload_at?.lte === undefined) {
      const gte = where.planned_unload_at.gte
      where.AND = where.AND || []
      where.AND.push({
        OR: [
          { planned_unload_at: { gte } },
          { planned_unload_at: null },
        ],
      })
      delete where.planned_unload_at
    }
    
    // 合并 orders 表的筛选条件（需要与现有的 operation_mode 条件合并）
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

    // 搜索条件
    if (search && search.trim()) {
      const searchConditions: any[] = [];
      
      // 柜号搜索（对应 orders.order_number）- 最重要的搜索字段
      searchConditions.push(
        { 
          orders: { 
            operation_mode: 'unload',
            order_number: { contains: search, mode: 'insensitive' } 
          } 
        }
      );
      
      // 客户名称搜索（需要同时满足操作方式为拆柜）
      searchConditions.push(
        { 
          orders: { 
            operation_mode: 'unload',
            customers: { name: { contains: search, mode: 'insensitive' } } 
          } 
        }
      );
      
      if (searchConditions.length > 0) {
        where.OR = searchConditions;
        // 保留基础的 operation_mode 条件，确保所有结果都是拆柜订单
        // 注意：OR 条件中的每个条件都已经包含了 operation_mode: 'unload'
      }
    }
    
    // 如果没有搜索条件，确保只显示操作方式为拆柜的订单
    if (!where.OR && !where.orders) {
      where.orders = {
        operation_mode: 'unload',
      };
    }

    // 排序 - 构建正确的排序条件
    let orderBy: any = {};
    
    // 判断排序字段是来自主表还是 orders 表
    const mainTableFields = ['inbound_receipt_id', 'status', 'planned_unload_at', 'unloaded_by', 'received_by', 'notes', 'created_at', 'updated_at', 'delivery_progress'];
    
    if (sort === 'container_number') {
      // container_number 实际对应 order_number
      orderBy = { orders: { order_number: order } };
    } else if (sort === 'carrier') {
      // 承运公司排序
      orderBy = { orders: { carriers: { name: order } } };
    } else if (sort === 'delivery_progress') {
      // 送仓进度为计算字段，先按主键查回再在内存中按计算值排序
      orderBy = { inbound_receipt_id: 'desc' };
    } else if (mainTableFields.includes(sort)) {
      // 主表字段直接排序
      orderBy = { [sort]: order };
    } else {
      // orders 表字段使用嵌套排序
      orderBy = {
        orders: {
          [sort]: order
        }
      };
    }

    // 按送仓进度排序时需先拉取较多数据，在内存中计算并排序后再分页
    const sortByDeliveryProgress = sort === 'delivery_progress';
    const skip = sortByDeliveryProgress ? 0 : (page - 1) * limit;
    const take = sortByDeliveryProgress ? 50000 : limit;

    // 查询数据
    // 注意：inbound_receipt 在 wms schema 中，Prisma 客户端应该能直接访问
    let items: any[];
    let total: number;
    
    try {
      // 构建 include 对象，确保所有关联都正确
      // 注意：用户关联字段需要在 Prisma Client 重新生成后才可用
      // 如果遇到 "Unknown field" 错误，请运行: npx prisma generate
      const includeConfig: any = {
        orders: {
          select: {
            order_id: true,
            order_number: true,
            order_date: true,
            eta_date: true,
            ready_date: true,
            lfd_date: true,
            pickup_date: true,
            carrier_id: true,
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
        warehouses: {
          select: {
            warehouse_id: true,
            name: true,
            warehouse_code: true,
          },
        },
        unload_methods: {
          select: {
            method_code: true,
            description: true,
          },
        },
        inventory_lots: {
          select: {
            pallet_count: true,
            remaining_pallet_count: true,
          },
        },
      };

      // 尝试添加用户关联字段（如果 Prisma Client 已重新生成）
      // 如果这些字段不存在，查询仍会成功，只是不会包含用户信息
      try {
        includeConfig.users_inbound_receipt_received_byTousers = {
          select: {
            id: true,
            full_name: true,
            username: true,
          },
        };
        includeConfig.users_inbound_receipt_unloaded_byTousers = {
          select: {
            id: true,
            full_name: true,
            username: true,
          },
        };
      } catch (e) {
        // 如果字段不存在，忽略错误（会在下面的查询中处理）
        console.warn('用户关联字段可能不可用，请运行 npx prisma generate');
      }

      // 检查 Prisma 客户端是否有 inbound_receipt 模型
      if (!prisma.inbound_receipt) {
        throw new Error('Prisma 客户端未找到 inbound_receipt 模型，请运行 npx prisma generate');
      }

      // 先测试基本查询
      const queryOptions: any = {
        where,
        orderBy,
        skip,
        take,
      };

      // 添加 include，如果包含用户关联字段失败，使用简化版本
      queryOptions.include = includeConfig;

      // 尝试查询，如果失败（可能是 Prisma Client 未重新生成），使用简化版本
      try {
        [items, total] = await Promise.all([
          prisma.inbound_receipt.findMany(queryOptions),
          prisma.inbound_receipt.count({ where }),
        ]);
      } catch (queryError: any) {
        // 如果查询失败，可能是因为用户关联字段不存在
        if (queryError.message?.includes('Unknown field') || queryError.message?.includes('users_inbound_receipt')) {
          console.warn('用户关联字段不可用，使用简化查询。请运行: npx prisma generate');
          // 使用简化版本的 include（不包含用户关联字段）
          const simplifiedInclude = {
            orders: {
              select: {
                order_id: true,
                order_number: true,
                order_date: true,
                eta_date: true,
                ready_date: true,
                lfd_date: true,
                pickup_date: true,
                carrier_id: true,
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
            warehouses: {
              select: {
                warehouse_id: true,
                name: true,
                warehouse_code: true,
              },
            },
            unload_methods: {
              select: {
                method_code: true,
                description: true,
              },
            },
            inventory_lots: {
              select: {
                pallet_count: true,
                remaining_pallet_count: true,
              },
            },
          };
          queryOptions.include = simplifiedInclude;
          [items, total] = await Promise.all([
            prisma.inbound_receipt.findMany(queryOptions),
            prisma.inbound_receipt.count({ where }),
          ]);
        } else {
          // 其他错误，直接抛出
          throw queryError;
        }
      }
    } catch (dbError: any) {
      console.error('数据库查询错误:', dbError);
      console.error('错误堆栈:', dbError.stack);
      throw new Error(`数据库查询失败: ${dbError.message || '未知错误'}`);
    }

    // 转换数据格式，添加关联字段
    const serializedItems = items.map((item: any) => {
      try {
        const serialized = serializeBigInt(item);
        const order = serialized.orders;
        
        // 如果 orders 关联存在但没有 customers，尝试单独查询
        let customerName = null;
        if (order && order.customers) {
          customerName = order.customers.name || null;
        } else if (order && order.order_id) {
          // 如果关联查询失败，customer_name 保持为 null
        }
        
        // 柜号使用订单号（order_number），与海柜管理保持一致
        const containerNumber = order?.order_number || null;
        
        // 计算送货进度：明细为 (实际板数-剩余板数)/实际板数，剩余=0 为 100%；主行 = 各明细按板数加权平均
        let calculatedDeliveryProgress = 0;
        const inventoryLots = serialized.inventory_lots || [];
        if (inventoryLots.length > 0) {
          let totalWeightedProgress = 0;
          let totalPallets = 0;
          inventoryLots.forEach((lot: any) => {
            const pallets = lot.pallet_count !== null && lot.pallet_count !== undefined ? Number(lot.pallet_count) : 0;
            const remaining = lot.remaining_pallet_count !== null && lot.remaining_pallet_count !== undefined ? Number(lot.remaining_pallet_count) : 0;
            if (pallets <= 0) return;
            const progress = remaining === 0 ? 100 : ((pallets - remaining) / pallets) * 100;
            totalWeightedProgress += progress * pallets;
            totalPallets += pallets;
          });
          if (totalPallets > 0) {
            calculatedDeliveryProgress = Math.round((totalWeightedProgress / totalPallets) * 100) / 100;
          }
        }
        
        return {
          ...serialized,
          customer_name: customerName,
          container_number: containerNumber,
          order_date: order?.order_date || null,
          eta_date: order?.eta_date || null,
          ready_date: order?.ready_date || null,
          lfd_date: order?.lfd_date || null,
          pickup_date: order?.pickup_date || null,
          carrier: order?.carriers || null, // 承运公司对象
          carrier_id: order?.carrier_id ? String(order.carrier_id) : null, // 承运公司ID
          unloaded_by: serialized.unloaded_by || null, // 拆柜人员ID
          received_by: serialized.received_by || null, // 入库人员ID
          // 保留关联数据，供前端显示用户名
          users_inbound_receipt_unloaded_byTousers: serialized.users_inbound_receipt_unloaded_byTousers || null,
          users_inbound_receipt_received_byTousers: serialized.users_inbound_receipt_received_byTousers || null,
          warehouse_name: serialized.warehouses?.name || null,
          unload_method_name: serialized.unload_methods?.description || null,
          // 计算后的送货进度（按板数加权平均）
          delivery_progress: calculatedDeliveryProgress,
          // 确保 order_id 也被包含，用于超链接
          order_id: order?.order_id || serialized.order_id || null,
        };
      } catch (itemError: any) {
        console.error('序列化数据项失败:', itemError, item);
        // 返回基本数据，避免整个请求失败
        return {
          ...serializeBigInt(item),
          customer_name: null,
          container_number: null,
          order_date: null,
          eta_date: null,
          ready_date: null,
          lfd_date: null,
          pickup_date: null,
          received_by: null,
          received_by_id: null,
          warehouse_name: null,
          unload_method_name: null,
        };
      }
    });

    // 按送仓进度排序时在内存中按计算后的 delivery_progress 排序再分页
    let resultItems = serializedItems;
    if (sortByDeliveryProgress && resultItems.length > 0) {
      const dir = order === 'asc' ? 1 : -1;
      resultItems = [...resultItems].sort((a: any, b: any) => {
        const va = a.delivery_progress != null ? Number(a.delivery_progress) : 0;
        const vb = b.delivery_progress != null ? Number(b.delivery_progress) : 0;
        return (va - vb) * dir;
      });
      resultItems = resultItems.slice((page - 1) * limit, page * limit);
    }

    // 调试：检查第一条数据的 container_number
    if (resultItems.length > 0 && process.env.NODE_ENV === 'development') {
      console.log('第一条拆柜规划数据:', {
        inbound_receipt_id: resultItems[0].inbound_receipt_id,
        container_number: resultItems[0].container_number,
        order_id: resultItems[0].order_id,
        order: resultItems[0].orders,
      });
    }

    return NextResponse.json({
      data: resultItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('获取拆柜规划列表失败:', error);
    // 输出详细错误信息以便调试
    if (error.message) {
      console.error('错误信息:', error.message);
    }
    if (error.code) {
      console.error('错误代码:', error.code);
    }
    if (error.stack) {
      console.error('错误堆栈:', error.stack);
    }
    
    // 返回详细的错误信息
    return NextResponse.json(
      {
        error: error.message || '获取拆柜规划列表失败',
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          code: error.code,
          stack: error.stack,
        } : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/wms/inbound-receipts
 * 创建拆柜规划
 */
export async function POST(request: NextRequest) {
  try {
    const permissionResult = await checkPermission(inboundReceiptConfig.permissions.create);
    if (permissionResult.error) return permissionResult.error;
    const currentUser = permissionResult.user;

    const body = await request.json();

    // 验证数据
    const validationResult = inboundReceiptCreateSchema.safeParse(body);
    if (!validationResult.success) {
      return handleValidationError(validationResult.error);
    }

    const data = validationResult.data;

    // 检查订单是否存在
    const order = await prisma.orders.findUnique({
      where: { order_id: BigInt(data.order_id) },
      select: {
        pickup_date: true,
        eta_date: true,
      },
    });
    if (!order) {
      return NextResponse.json(
        { error: '订单不存在' },
        { status: 404 }
      );
    }

    // 检查是否已存在该订单的拆柜规划
    const existing = await prisma.inbound_receipt.findUnique({
      where: { order_id: BigInt(data.order_id) },
    });
    if (existing) {
      return NextResponse.json(
        { error: '该订单已存在拆柜规划' },
        { status: 409 }
      );
    }

    // 准备创建数据
    const createData: any = {
      order_id: BigInt(data.order_id),
      warehouse_id: BigInt(data.warehouse_id),
      status: data.status,
      notes: data.notes || null,
      unloaded_by: data.unloaded_by || null,
      received_by: data.received_by ? BigInt(data.received_by) : null,
      // delivery_progress 默认值为 0，后续会根据关联的 inventory_lots 按板数加权平均计算
      delivery_progress: data.delivery_progress !== undefined && data.delivery_progress !== null ? data.delivery_progress : 0,
      unload_method_code: data.unload_method_code || null,
    };

    // 处理拆柜日期
    if (data.planned_unload_at) {
      // 如果提供了拆柜日期，使用提供的值
      const [year, month, day] = data.planned_unload_at.split('-').map(Number);
      createData.planned_unload_at = new Date(Date.UTC(year, month - 1, day));
    } else {
      // 如果没有提供拆柜日期，根据 Excel 公式自动计算
      const calculatedUnloadDate = calculateUnloadDate(order.pickup_date, order.eta_date);
      if (calculatedUnloadDate) {
        createData.planned_unload_at = calculatedUnloadDate;
      }
    }

    // 自动添加系统维护字段
    await addSystemFields(createData, currentUser, true);

    // 创建拆柜规划
    const inboundReceipt = await prisma.inbound_receipt.create({
      data: createData,
      include: inboundReceiptConfig.prisma?.include,
    });

    // 转换数据格式
    const serialized = serializeBigInt(inboundReceipt);
    const orderData = serialized.orders;

    return NextResponse.json(
      {
        data: {
          ...serialized,
          customer_name: orderData?.customers?.name || null,
          container_number: orderData?.order_number || null,
          order_date: orderData?.order_date || null,
          eta_date: orderData?.eta_date || null,
          ready_date: orderData?.ready_date || null,
          lfd_date: orderData?.lfd_date || null,
          pickup_date: orderData?.pickup_date || null,
          received_by: serialized.users_inbound_receipt_received_byTousers?.full_name || null,
          received_by_id: serialized.received_by || null,
          unloaded_by: serialized.users_inbound_receipt_unloaded_byTousers?.full_name || null, // 拆柜人员（显示用户名）
          unloaded_by_id: serialized.unloaded_by || null, // 拆柜人员ID
          warehouse_name: serialized.warehouses?.name || null,
          unload_method_name: serialized.unload_methods?.description || null,
        },
        message: '拆柜规划创建成功',
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '该订单已存在拆柜规划' },
        { status: 409 }
      );
    }
    return handleError(error, '创建拆柜规划失败');
  }
}

