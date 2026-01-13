import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, checkPermission, handleValidationError, handleError, serializeBigInt, addSystemFields } from '@/lib/api/helpers';
import { inboundReceiptUpdateSchema } from '@/lib/validations/inbound-receipt';
import { inboundReceiptConfig } from '@/lib/crud/configs/inbound-receipts';
import prisma from '@/lib/prisma';
import { calculateUnloadDate } from '@/lib/utils/calculate-unload-date';

/**
 * GET /api/wms/inbound-receipts/:id
 * 获取拆柜规划详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

    const resolvedParams = params instanceof Promise ? await params : params;

    const inboundReceipt = await prisma.inbound_receipt.findUnique({
      where: { inbound_receipt_id: BigInt(resolvedParams.id) },
      include: {
        ...inboundReceiptConfig.prisma?.include,
        orders: {
          select: {
            order_id: true,
            order_number: true,
            order_date: true,
            eta_date: true,
            ready_date: true,
            lfd_date: true,
            pickup_date: true,
            customers: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            order_detail: {
              select: {
                id: true,
                quantity: true,
                volume: true,
                container_volume: true,
                estimated_pallets: true,
                delivery_nature: true,
              } as any,
            },
          },
        },
        inventory_lots: {
          select: {
            inventory_lot_id: true,
            order_detail_id: true,
            storage_location_code: true,
            pallet_count: true,
            remaining_pallet_count: true,
            unbooked_pallet_count: true,
            delivery_progress: true,
            order_detail: {
              select: {
                id: true,
                delivery_nature: true,
                container_volume: true,
                volume: true,
                estimated_pallets: true,
              } as any,
            },
            orders: {
              select: {
                delivery_location: true,
              },
            },
          } as any,
        },
      },
    });

    if (!inboundReceipt) {
      return NextResponse.json(
        { error: '拆柜规划不存在' },
        { status: 404 }
      );
    }

    // 转换数据格式
    const serialized = serializeBigInt(inboundReceipt);
    const orderData = serialized.orders;

    // 计算整柜体积（从order_detail的container_volume总和）
    const totalContainerVolume = orderData?.order_detail?.reduce((sum: number, detail: any) => {
      const volume = detail.container_volume ? Number(detail.container_volume) : 0;
      return sum + volume;
    }, 0) || 0;

    // 计算送货进度：从关联的 inventory_lots 按板数加权平均
    // 公式：delivery_progress = Σ(delivery_progress_i * pallet_count_i) / Σ(pallet_count_i)
    let calculatedDeliveryProgress = 0;
    const inventoryLots = serialized.inventory_lots || [];
    if (inventoryLots.length > 0) {
      let totalWeightedProgress = 0;
      let totalPallets = 0;
      
      inventoryLots.forEach((lot: any) => {
        const progress = lot.delivery_progress !== null && lot.delivery_progress !== undefined 
          ? Number(lot.delivery_progress) 
          : 0;
        const pallets = lot.pallet_count !== null && lot.pallet_count !== undefined 
          ? Number(lot.pallet_count) 
          : 0;
        
        if (pallets > 0) {
          totalWeightedProgress += progress * pallets;
          totalPallets += pallets;
        }
      });
      
      if (totalPallets > 0) {
        calculatedDeliveryProgress = totalWeightedProgress / totalPallets;
      }
    }

    return NextResponse.json({
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
        warehouse_name: serialized.warehouses?.name || null,
        unload_method_name: serialized.unload_methods?.description || null,
        // 计算后的送货进度（按板数加权平均）
        delivery_progress: calculatedDeliveryProgress,
        total_container_volume: totalContainerVolume,
        order_details: orderData?.order_detail || [],
        inventory_lots: serialized.inventory_lots || [],
      },
    });
  } catch (error) {
    return handleError(error, '获取拆柜规划详情失败');
  }
}

/**
 * PUT /api/wms/inbound-receipts/:id
 * 更新拆柜规划
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const permissionResult = await checkPermission(inboundReceiptConfig.permissions.update);
    if (permissionResult.error) return permissionResult.error;
    const currentUser = permissionResult.user;

    const resolvedParams = params instanceof Promise ? await params : params;

    // 检查拆柜规划是否存在
    const existing = await prisma.inbound_receipt.findUnique({
      where: { inbound_receipt_id: BigInt(resolvedParams.id) },
      include: {
        orders: {
          select: {
            pickup_date: true,
            eta_date: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '拆柜规划不存在' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // 验证数据
    const validationResult = inboundReceiptUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return handleValidationError(validationResult.error);
    }

    const data = validationResult.data;

    // 准备更新数据
    const updateData: any = {};

    if (data.status !== undefined) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    if (data.unloaded_by !== undefined) {
      // unloaded_by 存储的是用户名字符串
      // 如果传入的是用户ID（数字字符串），需要转换为用户名字
      if (data.unloaded_by && /^\d+$/.test(String(data.unloaded_by))) {
        try {
          const userId = BigInt(data.unloaded_by)
          const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { full_name: true, username: true },
          })
          updateData.unloaded_by = user?.full_name || user?.username || null
        } catch (error) {
          console.error('获取用户名字失败:', error)
          updateData.unloaded_by = data.unloaded_by || null
        }
      } else {
        updateData.unloaded_by = data.unloaded_by || null
      }
    }
    if (data.received_by !== undefined) updateData.received_by = data.received_by ? BigInt(data.received_by) : null;
    // delivery_progress 是自动生成的，不允许手动修改
    if (data.unload_method_code !== undefined) updateData.unload_method_code = data.unload_method_code || null;
    if (data.warehouse_id !== undefined) updateData.warehouse_id = BigInt(data.warehouse_id);
    if (data.order_id !== undefined) updateData.order_id = BigInt(data.order_id);

    // 处理拆柜日期
    if (data.planned_unload_at !== undefined) {
      if (data.planned_unload_at) {
        // 如果提供了拆柜日期，使用提供的值
        const [year, month, day] = data.planned_unload_at.split('-').map(Number);
        updateData.planned_unload_at = new Date(Date.UTC(year, month - 1, day));
      } else {
        // 如果明确设置为空，则设置为 null
        updateData.planned_unload_at = null;
      }
    } else {
      // 如果没有提供 planned_unload_at，且订单日期可能已更新，则自动重新计算
      // 获取当前订单的日期（可能已更新）
      const currentOrder = await prisma.orders.findUnique({
        where: { order_id: BigInt(existing.order_id) },
        select: {
          pickup_date: true,
          eta_date: true,
        },
      });
      
      if (currentOrder) {
        const calculatedUnloadDate = calculateUnloadDate(currentOrder.pickup_date, currentOrder.eta_date);
        if (calculatedUnloadDate) {
          updateData.planned_unload_at = calculatedUnloadDate;
        }
      }
    }

    // 自动添加系统维护字段（只更新修改人/时间）
    await addSystemFields(updateData, currentUser, false);

    // 更新拆柜规划
    // 添加调试日志
    if (process.env.NODE_ENV === 'development') {
      console.log('[inbound-receipts PUT] 更新数据:', updateData)
    }
    
    const inboundReceipt = await prisma.inbound_receipt.update({
      where: { inbound_receipt_id: BigInt(resolvedParams.id) },
      data: updateData,
      include: {
        ...inboundReceiptConfig.prisma?.include,
        inventory_lots: {
          select: {
            delivery_progress: true,
            pallet_count: true,
          },
        },
      },
    });

    // 转换数据格式
    const serialized = serializeBigInt(inboundReceipt);
    const orderData = serialized.orders;

    // 查找 unloaded_by 对应的用户ID（如果 unloaded_by 是用户名字符串）
    let unloadedById: string | null = null
    if (serialized.unloaded_by) {
      try {
        const user = await prisma.users.findFirst({
          where: {
            OR: [
              { username: serialized.unloaded_by },
              { full_name: serialized.unloaded_by },
            ],
          },
          select: { id: true },
        })
        if (user) {
          unloadedById = String(user.id)
        }
      } catch (error) {
        console.error('查找 unloaded_by 用户ID失败:', error)
      }
    }

    // 计算送货进度：从关联的 inventory_lots 按板数加权平均
    // 公式：delivery_progress = Σ(delivery_progress_i * pallet_count_i) / Σ(pallet_count_i)
    let calculatedDeliveryProgress = 0;
    const inventoryLots = serialized.inventory_lots || [];
    if (inventoryLots.length > 0) {
      let totalWeightedProgress = 0;
      let totalPallets = 0;
      
      inventoryLots.forEach((lot: any) => {
        const progress = lot.delivery_progress !== null && lot.delivery_progress !== undefined 
          ? Number(lot.delivery_progress) 
          : 0;
        const pallets = lot.pallet_count !== null && lot.pallet_count !== undefined 
          ? Number(lot.pallet_count) 
          : 0;
        
        if (pallets > 0) {
          totalWeightedProgress += progress * pallets;
          totalPallets += pallets;
        }
      });
      
      if (totalPallets > 0) {
        calculatedDeliveryProgress = totalWeightedProgress / totalPallets;
      }
    }

    return NextResponse.json({
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
        unloaded_by: serialized.unloaded_by || null, // 拆柜人员（用户名字符串）
        unloaded_by_id: unloadedById, // 拆柜人员ID（用于前端编辑）
        warehouse_name: serialized.warehouses?.name || null,
        unload_method_name: serialized.unload_methods?.description || null,
        // 计算后的送货进度（按板数加权平均）
        delivery_progress: calculatedDeliveryProgress,
      },
      message: '拆柜规划更新成功',
    });
  } catch (error: any) {
    // 添加详细的错误日志
    console.error('[inbound-receipts PUT] 更新失败:', {
      error: error,
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    })
    return handleError(error, '更新拆柜规划失败');
  }
}

/**
 * DELETE /api/wms/inbound-receipts/:id
 * 删除拆柜规划
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const permissionResult = await checkPermission(inboundReceiptConfig.permissions.delete);
    if (permissionResult.error) return permissionResult.error;

    const resolvedParams = params instanceof Promise ? await params : params;

    // 检查拆柜规划是否存在
    const inboundReceipt = await prisma.inbound_receipt.findUnique({
      where: { inbound_receipt_id: BigInt(resolvedParams.id) },
      include: {
        inventory_lots: {
          take: 1,
        },
      },
    });

    if (!inboundReceipt) {
      return NextResponse.json(
        { error: '拆柜规划不存在' },
        { status: 404 }
      );
    }

    // 检查是否有关联数据
    if (inboundReceipt.inventory_lots.length > 0) {
      return NextResponse.json(
        { error: '拆柜规划有关联库存批次，无法删除' },
        { status: 409 }
      );
    }

    // 删除拆柜规划
    await prisma.inbound_receipt.delete({
      where: { inbound_receipt_id: BigInt(resolvedParams.id) },
    });

    return NextResponse.json({
      message: '拆柜规划删除成功',
    });
  } catch (error: any) {
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: '拆柜规划有关联数据，无法删除' },
        { status: 409 }
      );
    }
    return handleError(error, '删除拆柜规划失败');
  }
}

