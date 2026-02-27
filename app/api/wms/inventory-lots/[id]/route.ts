import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, checkPermission, handleValidationError, handleError, serializeBigInt, addSystemFields } from '@/lib/api/helpers';
import { inventoryLotUpdateSchema } from '@/lib/validations/inventory-lot';
import prisma from '@/lib/prisma';

// GET - 获取单个库存管理记录
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = BigInt(resolvedParams.id);

    const item = await prisma.inventory_lots.findUnique({
      where: { inventory_lot_id: id },
      include: {
        orders: {
          select: {
            order_id: true,
            order_number: true,
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

    if (!item) {
      return NextResponse.json({ error: '库存管理记录不存在' }, { status: 404 });
    }

    const serialized = serializeBigInt(item);
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
    });
  } catch (error: any) {
    return handleError(error, '获取库存管理记录失败');
  }
}

// PUT - 更新库存管理记录
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = BigInt(resolvedParams.id);
    const body = await request.json();

    // 验证输入
    const validationResult = inventoryLotUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return handleValidationError(validationResult.error);
    }

    const data = validationResult.data;

    // 检查记录是否存在
    const existing = await prisma.inventory_lots.findUnique({
      where: { inventory_lot_id: id },
    });
    if (!existing) {
      return NextResponse.json({ error: '库存管理记录不存在' }, { status: 404 });
    }

    const orderDetailId = existing.order_detail_id;
    // 仅当请求体明确提供有效数字时才认为「修改了实际板数」，避免只改仓库位置时把板数误写成 0
    const hasValidPalletCount =
      data.pallet_count !== undefined &&
      data.pallet_count !== null &&
      !Number.isNaN(Number(data.pallet_count));
    const newPalletCount = hasValidPalletCount ? Number(data.pallet_count) : existing.pallet_count;
    const shouldRecalculate =
      hasValidPalletCount && Number(data.pallet_count) !== Number(existing.pallet_count);

    // 构建更新数据
    const updateData: any = {};

    if (data.storage_location_code !== undefined) {
      updateData.storage_location_code = data.storage_location_code || null;
    }
    // 如果实际板数变化了，自动重新计算；否则不触碰板数字段（仅改仓库位置时不改板数）
    if (shouldRecalculate) {
      // 使用 recalc-unbooked-remaining 服务来统一计算（与订单明细主表保持一致）
      // 该服务会考虑拒收板数，使用有效占用公式：estimated_pallets - rejected_pallets
      const { recalcUnbookedRemainingForOrderDetail } = await import('@/lib/services/recalc-unbooked-remaining.service')
      
      // 在事务中更新实际板数并重算未约板数和剩余板数
      await prisma.$transaction(async (tx) => {
        // 先更新实际板数
        await tx.inventory_lots.update({
          where: { inventory_lot_id: id },
          data: { pallet_count: newPalletCount },
        })
        
        // 然后使用统一的重算服务来更新未约板数和剩余板数
        await recalcUnbookedRemainingForOrderDetail(orderDetailId, tx)
      })
      
      // 重新查询更新后的值（用于返回和后续处理）
      const updated = await prisma.inventory_lots.findUnique({
        where: { inventory_lot_id: id },
        select: {
          unbooked_pallet_count: true,
          remaining_pallet_count: true,
        },
      })
      
      if (updated) {
        updateData.unbooked_pallet_count = updated.unbooked_pallet_count
        updateData.remaining_pallet_count = updated.remaining_pallet_count
      }
      // 注意：pallet_count 已经在事务中更新了，不需要再放入 updateData
    } else {
      // 实际板数未变化：仅写入实际板数（若请求体明确提供）；剩余板数/未约板数由系统在「实际板数变化」时重算，此处不写入，避免只改仓库位置时被前端传的 0 误覆盖
      if (hasValidPalletCount) {
        updateData.pallet_count = Number(data.pallet_count);
      }
      // 不根据请求体更新 remaining_pallet_count / unbooked_pallet_count，保持库内原值
    }
    if (data.delivery_progress !== undefined) {
      updateData.delivery_progress = data.delivery_progress ? Number(data.delivery_progress) : null;
    }
    if (data.notes !== undefined) {
      updateData.notes = data.notes || null;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
    }
    if (data.lot_number !== undefined) {
      updateData.lot_number = data.lot_number || null;
    }
    if (data.received_date !== undefined) {
      updateData.received_date = data.received_date ? new Date(data.received_date) : null;
    }
    if (data.warehouse_id !== undefined) {
      updateData.warehouse_id = BigInt(data.warehouse_id);
    }
    if (data.inbound_receipt_id !== undefined) {
      updateData.inbound_receipt_id = data.inbound_receipt_id ? BigInt(data.inbound_receipt_id) : null;
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
    await addSystemFields(updateData, currentUser, false);

    // 更新记录（include 与列表 API 一致，含仓点与预约明细，避免前端用返回值替换行数据后仓点/预约消失）
    const updated = await prisma.inventory_lots.update({
      where: { inventory_lot_id: id },
      data: updateData,
      include: {
        orders: {
          select: {
            order_id: true,
            order_number: true,
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

    const serialized = serializeBigInt(updated);
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
    });
  } catch (error: any) {
    return handleError(error, '更新库存管理记录失败');
  }
}

// DELETE - 删除库存管理记录
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = BigInt(resolvedParams.id);

    const existing = await prisma.inventory_lots.findUnique({
      where: { inventory_lot_id: id },
    });
    if (!existing) {
      return NextResponse.json({ error: '库存管理记录不存在' }, { status: 404 });
    }

    await prisma.inventory_lots.delete({
      where: { inventory_lot_id: id },
    });

    return NextResponse.json({ message: '库存管理记录已删除' });
  } catch (error: any) {
    return handleError(error, '删除库存管理记录失败');
  }
}

