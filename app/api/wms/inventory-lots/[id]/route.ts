import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, checkPermission, handleValidationError, handleError, serializeBigInt, addSystemFields } from '@/lib/api/helpers';
import { inventoryLotUpdateSchema } from '@/lib/validations/inventory-lot';
import prisma from '@/lib/prisma';

// GET - 获取单个库存管理记录
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
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
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
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
    const newPalletCount = data.pallet_count !== undefined ? data.pallet_count : existing.pallet_count;

    // 如果实际板数变化了，需要重新计算未约板数和剩余板数
    let shouldRecalculate = data.pallet_count !== undefined && data.pallet_count !== existing.pallet_count;

    // 构建更新数据
    const updateData: any = {};

    if (data.storage_location_code !== undefined) {
      updateData.storage_location_code = data.storage_location_code || null;
    }
    if (data.pallet_count !== undefined) {
      updateData.pallet_count = data.pallet_count;
    }
    // 如果实际板数变化了，自动重新计算；否则允许手动设置
    if (shouldRecalculate) {
      // 获取所有预约的预计板数之和（用于计算未约板数）
      const appointmentLines = await prisma.appointment_detail_lines.findMany({
        where: { order_detail_id: orderDetailId },
        select: { estimated_pallets: true },
      });
      const totalAppointmentPallets = appointmentLines.reduce((sum, line) => {
        return sum + (line.estimated_pallets || 0);
      }, 0);

      // 获取所有未过期预约的预计板数之和（用于计算剩余板数）
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

      // 自动计算
      updateData.unbooked_pallet_count = newPalletCount - totalAppointmentPallets;
      updateData.remaining_pallet_count = newPalletCount - totalExpiredAppointmentPallets;
    } else {
      // 允许手动设置（但通常不建议）
      if (data.remaining_pallet_count !== undefined) {
        updateData.remaining_pallet_count = data.remaining_pallet_count ?? 0;
      }
      if (data.unbooked_pallet_count !== undefined) {
        updateData.unbooked_pallet_count = data.unbooked_pallet_count ?? 0;
      }
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

    // 更新记录
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
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
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

