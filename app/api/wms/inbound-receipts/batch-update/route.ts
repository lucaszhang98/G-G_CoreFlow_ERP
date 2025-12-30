/**
 * 入库管理批量更新 API 路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkPermission, handleValidationError, handleError, serializeBigInt, addSystemFields } from '@/lib/api/helpers';
import { inboundReceiptUpdateSchema } from '@/lib/validations/inbound-receipt';
import { inboundReceiptConfig } from '@/lib/crud/configs/inbound-receipts';
import prisma from '@/lib/prisma';

/**
 * POST /api/wms/inbound-receipts/batch-update
 * 批量更新入库管理记录
 */
export async function POST(request: NextRequest) {
  try {
    const permissionResult = await checkPermission(inboundReceiptConfig.permissions.update);
    if (permissionResult.error) return permissionResult.error;
    const currentUser = permissionResult.user;

    const body = await request.json();
    const { ids, updates } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: '请提供要更新的记录ID列表' },
        { status: 400 }
      );
    }

    if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: '请提供要更新的字段' },
        { status: 400 }
      );
    }

    // 验证更新数据
    const validationResult = inboundReceiptUpdateSchema.safeParse(updates);
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
    // delivery_progress 是自动生成的，不允许手动修改
    if (data.unload_method_code !== undefined) updateData.unload_method_code = data.unload_method_code || null;
    if (data.warehouse_id !== undefined) updateData.warehouse_id = BigInt(data.warehouse_id);
    if (data.order_id !== undefined) updateData.order_id = BigInt(data.order_id);

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
    await addSystemFields(updateData, currentUser, false);

    // 批量更新
    const result = await prisma.inbound_receipt.updateMany({
      where: {
        inbound_receipt_id: {
          in: ids.map((id: string | number) => BigInt(id)),
        },
      },
      data: updateData,
    });

    return NextResponse.json({
      message: `成功更新 ${result.count} 条记录`,
      count: result.count,
    });
  } catch (error: any) {
    return handleError(error, '批量更新入库管理记录失败');
  }
}

