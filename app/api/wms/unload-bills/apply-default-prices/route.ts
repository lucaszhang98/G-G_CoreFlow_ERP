import { NextRequest, NextResponse } from 'next/server';
import { checkPermission } from '@/lib/api/helpers';
import prisma from '@/lib/prisma';

const ROLES = ['admin', 'wms_manager', 'tms_manager', 'employee', 'user', 'oms_operator', 'wms_operator'];

/** 默认价格：拆柜人员为 francisco 的 210，其他 200 */
const AMOUNT_FRANCISCO = 210;
const AMOUNT_OTHERS = 200;
const USERNAME_FRANCISCO = 'francisco';

/** POST 对指定入库单批量填充默认价格（francisco=210，其他=200） */
export async function POST(request: NextRequest) {
  try {
    const permissionResult = await checkPermission(ROLES);
    if (permissionResult.error) return permissionResult.error;

    const body = await request.json();
    const ids = Array.isArray(body.inbound_receipt_ids)
      ? body.inbound_receipt_ids.map((id: unknown) => (typeof id === 'number' ? id : Number(id))).filter((n: number) => !Number.isNaN(n))
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: '请提供 inbound_receipt_ids 数组' }, { status: 400 });
    }

    const inboundReceipts = await prisma.inbound_receipt.findMany({
      where: {
        inbound_receipt_id: { in: ids.map((id) => BigInt(id)) },
        orders: { operation_mode: 'unload' },
      },
      select: {
        inbound_receipt_id: true,
        unloaded_by: true,
      },
    });

    const unloadedByIds = [...new Set(inboundReceipts.map((ir) => ir.unloaded_by).filter((id): id is bigint => id != null))];
    const users =
      unloadedByIds.length > 0
        ? await prisma.users.findMany({
            where: { id: { in: unloadedByIds } },
            select: { id: true, username: true },
          })
        : [];
    const usernameById = Object.fromEntries(users.map((u) => [u.id.toString(), (u.username ?? '').toLowerCase()]));

    let updated = 0;
    for (const ir of inboundReceipts) {
      const userId = ir.unloaded_by?.toString() ?? null;
      const username = userId ? usernameById[userId] ?? '' : '';
      const amount = username === USERNAME_FRANCISCO ? AMOUNT_FRANCISCO : AMOUNT_OTHERS;

      await prisma.unload_bill.upsert({
        where: { inbound_receipt_id: ir.inbound_receipt_id },
        create: { inbound_receipt_id: ir.inbound_receipt_id, amount },
        update: { amount },
      });
      updated += 1;
    }

    return NextResponse.json({ ok: true, updated });
  } catch (e) {
    console.error('[unload-bills apply-default-prices]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '批量填充默认价格失败' },
      { status: 500 }
    );
  }
}
