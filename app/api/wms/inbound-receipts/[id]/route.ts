import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, checkPermission, WMS_FULL_ACCESS_PERMISSION_OPTIONS, handleValidationError, handleError, serializeBigInt, addSystemFields } from '@/lib/api/helpers';
import { inboundReceiptUpdateSchema } from '@/lib/validations/inbound-receipt';
import { inboundReceiptConfig } from '@/lib/crud/configs/inbound-receipts';
import prisma from '@/lib/prisma';
import { computeInboundReceiptHeaderDeliveryProgress } from '@/lib/utils/inbound-delivery-progress';
import { calculateUnloadDate } from '@/lib/utils/calculate-unload-date';

function includesInspectionKeyword(currentLocation: string | null | undefined): boolean {
  return typeof currentLocation === 'string' && currentLocation.includes('查验');
}

/**
 * GET /api/wms/inbound-receipts/:id
 * 获取拆柜规划详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

    const resolvedParams = await params;

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
            order_detail: {
              select: {
                id: true,
                quantity: true,
                volume: true,
                container_volume: true,
                estimated_pallets: true,
                delivery_nature: true,
                appointment_detail_lines: {
                  select: {
                    estimated_pallets: true,
                    rejected_pallets: true,
                    delivery_appointments: {
                      select: {
                        confirmed_start: true,
                      },
                    },
                  },
                },
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
            pallet_counts_verified: true,
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

    const inventoryLots = serialized.inventory_lots || [];
    const calculatedDeliveryProgress = computeInboundReceiptHeaderDeliveryProgress({
      orderDetails: orderData?.order_detail || [],
      inventoryLots,
    });

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
        carrier: orderData?.carriers || null, // 承运公司对象
        carrier_id: orderData?.carrier_id ? String(orderData.carrier_id) : null, // 承运公司ID
        received_by: serialized.received_by || null, // 入库人员ID
        unloaded_by: serialized.unloaded_by || null, // 拆柜人员ID
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const permissionResult = await checkPermission(inboundReceiptConfig.permissions.update, WMS_FULL_ACCESS_PERMISSION_OPTIONS);
    if (permissionResult.error) return permissionResult.error;
    const currentUser = permissionResult.user;

    const resolvedParams = await params;

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
    if (data.arrived_at_warehouse !== undefined) updateData.arrived_at_warehouse = Boolean(data.arrived_at_warehouse);
    if (data.unloaded_by !== undefined) updateData.unloaded_by = data.unloaded_by ? BigInt(data.unloaded_by) : null;
    if (data.received_by !== undefined) updateData.received_by = data.received_by ? BigInt(data.received_by) : null;
    // delivery_progress 是自动生成的，不允许手动修改
    if (data.unload_method_code !== undefined) updateData.unload_method_code = data.unload_method_code || null;
    if (data.warehouse_id !== undefined) updateData.warehouse_id = BigInt(data.warehouse_id);
    if (data.order_id !== undefined) updateData.order_id = BigInt(data.order_id);

    const hasCurrentLocationUpdate = data.current_location !== undefined;
    const targetOrderId = data.order_id !== undefined ? BigInt(data.order_id) : existing.order_id;
    let normalizedCurrentLocation: string | null = null;
    if (hasCurrentLocationUpdate) {
      const raw = data.current_location;
      normalizedCurrentLocation = raw && String(raw).trim() ? String(raw).trim() : null;
    }

    // 处理拆柜日期：仅当请求中明确传入 planned_unload_at 时才更新，否则保留原值（避免只改状态时被重算覆盖）
    if (data.planned_unload_at !== undefined) {
      if (data.planned_unload_at) {
        const [year, month, day] = data.planned_unload_at.split('-').map(Number);
        updateData.planned_unload_at = new Date(Date.UTC(year, month - 1, day));
      } else {
        updateData.planned_unload_at = null;
      }
    }

    // 业务规则：当前位置信息含「查验」时，入库状态=查验 且拆柜日期置空；
    // 不含时，入库状态=待处理 且按提柜/ETA自动回算拆柜日期。
    if (hasCurrentLocationUpdate) {
      const inspection = includesInspectionKeyword(normalizedCurrentLocation);
      updateData.status = inspection ? 'inspection' : 'pending';
      updateData.planned_unload_at = inspection
        ? null
        : calculateUnloadDate(existing.orders?.pickup_date, existing.orders?.eta_date);
    }

    // 自动添加系统维护字段（只更新修改人/时间）
    await addSystemFields(updateData, currentUser, false);

    // 同步写入提柜管理的现在位置（order级字段）
    if (hasCurrentLocationUpdate) {
      const pickupData: any = {
        current_location: normalizedCurrentLocation,
      };
      await addSystemFields(pickupData, currentUser, false);
      await prisma.pickup_management.upsert({
        where: { order_id: targetOrderId },
        update: pickupData,
        create: {
          order_id: targetOrderId,
          ...pickupData,
        },
      });
    }

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

    const progressSource = await prisma.inbound_receipt.findUnique({
      where: { inbound_receipt_id: BigInt(resolvedParams.id) },
      select: {
        inventory_lots: {
          select: {
            order_detail_id: true,
            pallet_count: true,
            pallet_counts_verified: true,
            remaining_pallet_count: true,
            unbooked_pallet_count: true,
          },
        },
        orders: {
          select: {
            order_detail: {
              select: {
                id: true,
                estimated_pallets: true,
                appointment_detail_lines: {
                  select: {
                    estimated_pallets: true,
                    rejected_pallets: true,
                    delivery_appointments: { select: { confirmed_start: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    const progressSer = serializeBigInt(progressSource);
    const calculatedDeliveryProgress = computeInboundReceiptHeaderDeliveryProgress({
      orderDetails: progressSer?.orders?.order_detail || [],
      inventoryLots: progressSer?.inventory_lots || [],
    });

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
        received_by: serialized.received_by || null, // 入库人员ID
        unloaded_by: serialized.unloaded_by || null, // 拆柜人员ID
        // 保留关联数据，供前端显示用户名
        users_inbound_receipt_unloaded_byTousers: serialized.users_inbound_receipt_unloaded_byTousers || null,
        users_inbound_receipt_received_byTousers: serialized.users_inbound_receipt_received_byTousers || null,
        warehouse_name: serialized.warehouses?.name || null,
        unload_method_name: serialized.unload_methods?.description || null,
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const permissionResult = await checkPermission(inboundReceiptConfig.permissions.delete, WMS_FULL_ACCESS_PERMISSION_OPTIONS);
    if (permissionResult.error) return permissionResult.error;

    const resolvedParams = await params;

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

