/**
 * 入库管理批量更新 API 路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkPermission, WMS_FULL_ACCESS_PERMISSION_OPTIONS, handleValidationError, handleError, serializeBigInt, addSystemFields } from '@/lib/api/helpers';
import { inboundReceiptUpdateSchema } from '@/lib/validations/inbound-receipt';
import { inboundReceiptConfig } from '@/lib/crud/configs/inbound-receipts';
import prisma from '@/lib/prisma';
import { calculateUnloadDate } from '@/lib/utils/calculate-unload-date';
import {
  inboundStatusBlocksUnload,
  resolveInboundStatusFromCurrentLocation,
} from '@/lib/wms/current-location-blocks-unload';
import {
  guardInboundPlannedUnloadAtInUpdate,
  isInboundPlannedUnloadAtAutoUpdateBlocked,
  resolveEffectiveInboundUnloadedBy,
} from '@/lib/wms/planned-unload-auto-update';

/**
 * POST /api/wms/inbound-receipts/batch-update
 * 批量更新入库管理记录
 */
export async function POST(request: NextRequest) {
  try {
    const permissionResult = await checkPermission(inboundReceiptConfig.permissions.update, WMS_FULL_ACCESS_PERMISSION_OPTIONS);
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
    if (data.arrived_at_warehouse !== undefined) updateData.arrived_at_warehouse = Boolean(data.arrived_at_warehouse);
    if (data.is_urgent !== undefined) updateData.is_urgent = Boolean(data.is_urgent);
    if (data.is_changed !== undefined) updateData.is_changed = Boolean(data.is_changed);
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    if (data.unloaded_by !== undefined) updateData.unloaded_by = data.unloaded_by || null;
    if (data.received_by !== undefined) updateData.received_by = data.received_by ? BigInt(data.received_by) : null;
    // delivery_progress 是自动生成的，不允许手动修改
    if (data.unload_method_code !== undefined) updateData.unload_method_code = data.unload_method_code || null;
    if (data.warehouse_id !== undefined) updateData.warehouse_id = BigInt(data.warehouse_id);
    if (data.order_id !== undefined) updateData.order_id = BigInt(data.order_id);
    const hasCurrentLocationUpdate = data.current_location !== undefined;
    const normalizedCurrentLocation =
      data.current_location && String(data.current_location).trim()
        ? String(data.current_location).trim()
        : null;

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

    // 批量改状态时清空拆柜日：仅对未填拆柜人员的行生效（见 per-row 逻辑）
    const batchClearUnloadDateOnBlockedStatus =
      data.status !== undefined &&
      inboundStatusBlocksUnload(data.status) &&
      !hasCurrentLocationUpdate &&
      data.planned_unload_at === undefined;

    const manualPlannedUnloadAtInRequest = data.planned_unload_at !== undefined;
    const inboundReceiptIds = ids.map((id: string | number) => BigInt(id));
    let result: { count: number };

    if (hasCurrentLocationUpdate) {
      const targets = await prisma.inbound_receipt.findMany({
        where: { inbound_receipt_id: { in: inboundReceiptIds } },
        select: {
          inbound_receipt_id: true,
          order_id: true,
          unloaded_by: true,
          orders: {
            select: {
              pickup_date: true,
              eta_date: true,
            },
          },
        },
      });

      const resolvedStatus =
        resolveInboundStatusFromCurrentLocation(normalizedCurrentLocation);
      const actorId = currentUser?.id ? BigInt(currentUser.id) : null;

      await prisma.$transaction(async (tx) => {
        for (const row of targets) {
          const effectiveUnloadedBy = resolveEffectiveInboundUnloadedBy({
            stored: row.unloaded_by,
            inRequest: data.unloaded_by,
          });
          const perRowUpdateData: Record<string, unknown> = {
            ...updateData,
            status: resolvedStatus ?? 'pending',
          };
          if (!isInboundPlannedUnloadAtAutoUpdateBlocked(effectiveUnloadedBy)) {
            perRowUpdateData.planned_unload_at = resolvedStatus
              ? null
              : calculateUnloadDate(row.orders?.pickup_date, row.orders?.eta_date);
          }

          await tx.inbound_receipt.update({
            where: { inbound_receipt_id: row.inbound_receipt_id },
            data: guardInboundPlannedUnloadAtInUpdate(perRowUpdateData, {
              unloadedBy: effectiveUnloadedBy,
              manualPlannedUnloadAtInRequest,
            }),
          });

          await tx.pickup_management.upsert({
            where: { order_id: row.order_id },
            update: {
              current_location: normalizedCurrentLocation,
              updated_by: actorId,
              updated_at: new Date(),
            },
            create: {
              order_id: row.order_id,
              current_location: normalizedCurrentLocation,
              created_by: actorId,
              updated_by: actorId,
            },
          });
        }
      });

      result = { count: targets.length };
    } else if (batchClearUnloadDateOnBlockedStatus) {
      const targets = await prisma.inbound_receipt.findMany({
        where: { inbound_receipt_id: { in: inboundReceiptIds } },
        select: { inbound_receipt_id: true, unloaded_by: true },
      });

      await prisma.$transaction(async (tx) => {
        for (const row of targets) {
          const effectiveUnloadedBy = resolveEffectiveInboundUnloadedBy({
            stored: row.unloaded_by,
            inRequest: data.unloaded_by,
          });
          const perRowUpdateData: Record<string, unknown> = { ...updateData };
          if (!isInboundPlannedUnloadAtAutoUpdateBlocked(effectiveUnloadedBy)) {
            perRowUpdateData.planned_unload_at = null;
          }
          await tx.inbound_receipt.update({
            where: { inbound_receipt_id: row.inbound_receipt_id },
            data: guardInboundPlannedUnloadAtInUpdate(perRowUpdateData, {
              unloadedBy: effectiveUnloadedBy,
              manualPlannedUnloadAtInRequest,
            }),
          });
        }
      });

      result = { count: targets.length };
    } else if (
      manualPlannedUnloadAtInRequest ||
      data.unloaded_by !== undefined
    ) {
      // 含拆柜日期或拆柜人员变更：按行应用锁定规则
      const targets = await prisma.inbound_receipt.findMany({
        where: { inbound_receipt_id: { in: inboundReceiptIds } },
        select: { inbound_receipt_id: true, unloaded_by: true },
      });

      await prisma.$transaction(async (tx) => {
        for (const row of targets) {
          const effectiveUnloadedBy = resolveEffectiveInboundUnloadedBy({
            stored: row.unloaded_by,
            inRequest: data.unloaded_by,
          });
          await tx.inbound_receipt.update({
            where: { inbound_receipt_id: row.inbound_receipt_id },
            data: guardInboundPlannedUnloadAtInUpdate(updateData, {
              unloadedBy: effectiveUnloadedBy,
              manualPlannedUnloadAtInRequest,
            }),
          });
        }
      });

      result = { count: targets.length };
    } else {
      // 普通批量更新（不涉及拆柜日期/拆柜人员）
      result = await prisma.inbound_receipt.updateMany({
        where: {
          inbound_receipt_id: {
            in: inboundReceiptIds,
          },
        },
        data: updateData,
      });
    }

    try {
      const affected = await prisma.inbound_receipt.findMany({
        where: { inbound_receipt_id: { in: inboundReceiptIds } },
        select: { order_id: true },
      })
      const { scheduleStorageInvoiceSync } = await import('@/lib/finance/storage-invoice-sync')
      const uid = currentUser?.id ? BigInt(currentUser.id) : null
      const done = new Set<string>()
      for (const row of affected) {
        const k = row.order_id.toString()
        if (done.has(k)) continue
        done.add(k)
        scheduleStorageInvoiceSync(row.order_id, uid)
      }
    } catch (e) {
      console.warn('[inbound-receipts batch-update] 仓储账单同步调度失败', e)
    }

    return NextResponse.json({
      message: `成功更新 ${result.count} 条记录`,
      count: result.count,
    });
  } catch (error: any) {
    return handleError(error, '批量更新入库管理记录失败');
  }
}

