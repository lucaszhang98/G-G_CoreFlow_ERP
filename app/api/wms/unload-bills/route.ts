import { NextRequest, NextResponse } from 'next/server';
import { checkPermission } from '@/lib/api/helpers';
import prisma from '@/lib/prisma';

const UNLOAD_BILL_LIST_ROLES = ['admin', 'wms_manager', 'tms_manager', 'employee', 'user', 'oms_operator', 'wms_operator'];

/** GET 拆柜账单列表：从入库管理自动提取，支持分页、排序、筛选 */
export async function GET(request: NextRequest) {
  try {
    const permissionResult = await checkPermission(UNLOAD_BILL_LIST_ROLES);
    if (permissionResult.error) return permissionResult.error;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const sort = searchParams.get('sort') || 'planned_unload_at';
    const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
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

    const orderBy =
      sort === 'container_number'
        ? [{ orders: { order_number: order } }]
        : sort === 'amount'
          ? [{ unload_bill: { amount: order } }, { inbound_receipt_id: 'desc' }]
          : sort === 'unloaded_by_name'
            ? [{ users_inbound_receipt_unloaded_byTousers: { username: order } }, { inbound_receipt_id: 'desc' }]
            : [{ planned_unload_at: order }, { inbound_receipt_id: 'desc' }];

    const [total, inboundList] = await Promise.all([
      prisma.inbound_receipt.count({ where }),
      prisma.inbound_receipt.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
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
      }),
    ]);

    // 拆柜人员显示：优先用用户代码(username)，与入库管理/用户管理一致
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

    const rows = inboundList.map((ir: any) => {
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
        ir.orders?.order_detail?.reduce((s: number, d: { quantity: number }) => s + (Number(d?.quantity) || 0), 0) ?? 0;
      return {
        unload_bill_id: bill ? Number(bill.unload_bill_id) : null,
        inbound_receipt_id: Number(ir.inbound_receipt_id),
        amount: bill ? Number(bill.amount) : 0,
        container_number: ir.orders?.order_number ?? '',
        planned_unload_at: ir.planned_unload_at ? ir.planned_unload_at.toISOString().slice(0, 10) : null,
        unloaded_by_id: unloadedById,
        unloaded_by_name: unloadedByName,
        total_box_count: totalBoxCount,
      };
    });

    return NextResponse.json({ data: rows, total });
  } catch (e) {
    console.error('[unload-bills GET]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '获取拆柜账单失败' },
      { status: 500 }
    );
  }
}

/** POST 创建或更新拆柜账单金额（按入库单，用于后续编辑价格） */
export async function POST(request: NextRequest) {
  try {
    const permissionResult = await checkPermission(UNLOAD_BILL_LIST_ROLES);
    if (permissionResult.error) return permissionResult.error;

    const body = await request.json();
    const inbound_receipt_id = body.inbound_receipt_id != null ? BigInt(body.inbound_receipt_id) : null;
    const amount = body.amount != null ? Number(body.amount) : 0;

    if (inbound_receipt_id == null) {
      return NextResponse.json({ error: '缺少 inbound_receipt_id' }, { status: 400 });
    }

    const existing = await prisma.unload_bill.findUnique({
      where: { inbound_receipt_id },
    });

    if (existing) {
      const updated = await prisma.unload_bill.update({
        where: { inbound_receipt_id },
        data: { amount },
      });
      return NextResponse.json({
        data: {
          unload_bill_id: Number(updated.unload_bill_id),
          inbound_receipt_id: Number(updated.inbound_receipt_id),
          amount: Number(updated.amount),
        },
      });
    }

    const created = await prisma.unload_bill.create({
      data: {
        inbound_receipt_id,
        amount,
      },
    });

    return NextResponse.json({
      data: {
        unload_bill_id: Number(created.unload_bill_id),
        inbound_receipt_id: Number(created.inbound_receipt_id),
        amount: Number(created.amount),
      },
    });
  } catch (e) {
    console.error('[unload-bills POST]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '保存拆柜账单失败' },
      { status: 500 }
    );
  }
}
