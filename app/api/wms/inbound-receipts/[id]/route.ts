import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, checkPermission, handleValidationError, handleError, serializeBigInt, addSystemFields } from '@/lib/api/helpers';
import { inboundReceiptUpdateSchema } from '@/lib/validations/inbound-receipt';
import { inboundReceiptConfig } from '@/lib/crud/configs/inbound-receipts';
import prisma from '@/lib/prisma';

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
            container_number: true,
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
              },
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
            unload_transfer_notes: true,
            notes: true,
            order_detail: {
              select: {
                id: true,
                delivery_nature: true,
                container_volume: true,
                volume: true,
                estimated_pallets: true,
              },
            },
            orders: {
              select: {
                delivery_location: true,
              },
            },
          },
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
    if (data.unloaded_by !== undefined) updateData.unloaded_by = data.unloaded_by || null;
    if (data.received_by !== undefined) updateData.received_by = data.received_by ? BigInt(data.received_by) : null;
    if (data.delivery_progress !== undefined) updateData.delivery_progress = data.delivery_progress !== null ? data.delivery_progress : null;
    if (data.unload_method_code !== undefined) updateData.unload_method_code = data.unload_method_code || null;
    if (data.warehouse_id !== undefined) updateData.warehouse_id = BigInt(data.warehouse_id);

    // 处理拆柜日期
    if (data.planned_unload_at !== undefined) {
      if (data.planned_unload_at) {
        const [year, month, day] = data.planned_unload_at.split('-').map(Number);
        updateData.planned_unload_at = new Date(Date.UTC(year, month - 1, day));
      } else {
        updateData.planned_unload_at = null;
      }
    }

    // 自动添加系统维护字段（只更新修改人/时间）
    addSystemFields(updateData, currentUser, false);

    // 更新拆柜规划
    const inboundReceipt = await prisma.inbound_receipt.update({
      where: { inbound_receipt_id: BigInt(resolvedParams.id) },
      data: updateData,
      include: inboundReceiptConfig.prisma?.include,
    });

    // 转换数据格式
    const serialized = serializeBigInt(inboundReceipt);
    const orderData = serialized.orders;

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
      },
      message: '拆柜规划更新成功',
    });
  } catch (error: any) {
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

