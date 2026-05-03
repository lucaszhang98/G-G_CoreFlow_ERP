import { NextRequest, NextResponse } from 'next/server';
import { inboundReceiptConfig } from '@/lib/crud/configs/inbound-receipts';
import { checkPermission, WMS_FULL_ACCESS_PERMISSION_OPTIONS, handleValidationError, handleError, serializeBigInt, addSystemFields } from '@/lib/api/helpers';
import { inboundReceiptCreateSchema } from '@/lib/validations/inbound-receipt';
import prisma from '@/lib/prisma';
import { calculateUnloadDate } from '@/lib/utils/calculate-unload-date';
import { runInboundReceiptListQuery } from '@/lib/wms/inbound-receipts-list-query';

// GET - 获取拆柜规划列表（与 lib/wms/inbound-receipts-list-query 同源）
export async function GET(request: NextRequest) {
  try {
    const permissionResult = await checkPermission(inboundReceiptConfig.permissions.list, WMS_FULL_ACCESS_PERMISSION_OPTIONS);
    if (permissionResult.error) return permissionResult.error;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '100', 10)));
    const sort = searchParams.get('sort') || 'created_at';
    const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';

    const { data, pagination } = await runInboundReceiptListQuery(searchParams, {
      type: 'paged',
      page,
      limit,
      sort,
      order,
    });

    return NextResponse.json({
      data,
      pagination,
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
    const permissionResult = await checkPermission(inboundReceiptConfig.permissions.create, WMS_FULL_ACCESS_PERMISSION_OPTIONS);
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
      // delivery_progress 默认 0；展示时由 API 按预约口径重算
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

    // 创建时：拆柜日期不能早于明天，若为今天或更早则强制为明天
    if (createData.planned_unload_at) {
      const now = new Date();
      const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const unloadDay = new Date(createData.planned_unload_at);
      const unloadDayStart = new Date(Date.UTC(unloadDay.getUTCFullYear(), unloadDay.getUTCMonth(), unloadDay.getUTCDate()));
      if (unloadDayStart.getTime() <= todayStart.getTime()) {
        createData.planned_unload_at = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      }
    }

    // 自动添加系统维护字段
    await addSystemFields(createData, currentUser, true);

    // 创建拆柜规划
    const inboundReceipt = await prisma.inbound_receipt.create({
      data: createData,
      include: inboundReceiptConfig.prisma?.include,
    });

    try {
      const { scheduleStorageInvoiceSync } = await import('@/lib/finance/storage-invoice-sync')
      scheduleStorageInvoiceSync(
        inboundReceipt.order_id,
        currentUser?.id ? BigInt(currentUser.id) : null
      )
    } catch (e) {
      console.warn('[inbound-receipts POST] 仓储账单同步调度失败', e)
    }

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

