import { NextRequest, NextResponse } from 'next/server';
import { checkPermission } from '@/lib/api/helpers';
import prisma from '@/lib/prisma';
import { generateUnloadBillExportExcel, UnloadBillExportRow } from '@/lib/utils/unload-bill-export-excel';

const ROLES = ['admin', 'wms_manager', 'tms_manager', 'employee', 'user', 'oms_operator', 'wms_operator'];

/**
 * GET 导出拆柜账单 Excel，按拆柜人员分组
 * 查询参数与列表一致：search, filter_planned_unload_at_from, filter_planned_unload_at_to, filter_unloaded_by
 */
export async function GET(request: NextRequest) {
  try {
    const permissionResult = await checkPermission(ROLES);
    if (permissionResult.error) return permissionResult.error;

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').trim();
    const filterUnloadedBy = searchParams.get('filter_unloaded_by');
    const plannedFrom = searchParams.get('filter_planned_unload_at_from');
    const plannedTo = searchParams.get('filter_planned_unload_at_to');

    const where: any = {
      orders: {
        operation_mode: 'unload',
        ...(search ? { order_number: { contains: search, mode: 'insensitive' } } : {}),
      },
      ...(filterUnloadedBy ? { unloaded_by: BigInt(filterUnloadedBy) } : {}),
    };

    if (plannedFrom || plannedTo) {
      const dateCondition: any = {};
      if (plannedFrom) dateCondition.gte = new Date(plannedFrom + 'T00:00:00.000Z');
      if (plannedTo) {
        const end = new Date(plannedTo + 'T00:00:00.000Z');
        end.setUTCHours(23, 59, 59, 999);
        dateCondition.lte = end;
      }
      where.planned_unload_at = dateCondition;
    }

    const inboundList = await prisma.inbound_receipt.findMany({
      where,
      orderBy: [{ planned_unload_at: 'desc' }, { inbound_receipt_id: 'desc' }],
      take: 10000,
      include: {
        orders: {
          select: {
            order_number: true,
            order_detail: { select: { quantity: true } },
          },
        },
        unload_bill: { select: { unload_bill_id: true, amount: true } },
        users_inbound_receipt_unloaded_byTousers: { select: { id: true, username: true, full_name: true } },
      },
    });

    const unloadedByIds = [...new Set(inboundList.map((ir) => ir.unloaded_by).filter((id): id is bigint => id != null))];
    const usersList =
      unloadedByIds.length > 0
        ? await prisma.users.findMany({
            where: { id: { in: unloadedByIds } },
            select: { id: true, username: true, full_name: true },
          })
        : [];
    const userDisplayById: Record<string, string> = Object.fromEntries(
      usersList.map((u) => [
        u.id.toString(),
        (u.username != null && String(u.username).trim() !== '' ? u.username : u.full_name) ?? '',
      ])
    );

    const rows: UnloadBillExportRow[] = inboundList.map((ir: any) => {
      const bill = ir.unload_bill;
      const unloadedById = ir.unloaded_by?.toString() ?? null;
      const fromRelation = ir.users_inbound_receipt_unloaded_byTousers;
      const fromRelationDisplay =
        fromRelation != null
          ? (fromRelation.username != null && String(fromRelation.username).trim() !== ''
            ? fromRelation.username
            : fromRelation.full_name) ?? ''
          : '';
      const fromMap = unloadedById ? (userDisplayById[unloadedById] ?? '') : '';
      const unloadedByName =
        (fromRelationDisplay !== '' ? fromRelationDisplay : fromMap !== '' ? fromMap : '') || '未指定';
      const totalBoxCount =
        ir.orders?.order_detail?.reduce((s: number, d: { quantity: unknown }) => s + (Number(d?.quantity) || 0), 0) ?? 0;
      return {
        container_number: ir.orders?.order_number ?? '',
        total_box_count: totalBoxCount,
        planned_unload_at: ir.planned_unload_at ? ir.planned_unload_at.toISOString().slice(0, 10) : null,
        amount: bill ? Number(bill.amount) : 0,
        unloaded_by_name: unloadedByName,
      };
    });

    const grouped = new Map<string, UnloadBillExportRow[]>();
    for (const row of rows) {
      const key = row.unloaded_by_name || '未指定';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `拆柜账单_按拆柜人员_${timestamp}`;
    const workbook = await generateUnloadBillExportExcel(grouped, filename);
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}.xlsx"`,
      },
    });
  } catch (e) {
    console.error('[unload-bills export]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '导出失败' },
      { status: 500 }
    );
  }
}
