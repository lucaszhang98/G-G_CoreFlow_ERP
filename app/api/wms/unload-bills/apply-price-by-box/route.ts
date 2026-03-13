import { NextRequest, NextResponse } from 'next/server';
import { checkPermission } from '@/lib/api/helpers';
import prisma from '@/lib/prisma';

const ROLES = ['admin', 'wms_manager', 'tms_manager', 'employee', 'user', 'oms_operator', 'wms_operator'];

/** 按箱数填入价格：多于 1200 箱填 220，小于等于 1200 箱填 200 */
const AMOUNT_OVER_1200 = 220;
const AMOUNT_1200_OR_LESS = 200;
const BOX_THRESHOLD = 1200;

/** POST 对指定入库单按箱数批量填入价格（>1200 箱=220，否则=200） */
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
        inbound_receipt_id: { in: ids.map((id: number) => BigInt(id)) },
        orders: { operation_mode: 'unload' },
      },
      include: {
        orders: {
          select: {
            order_detail: { select: { quantity: true } },
          },
        },
      },
    });

    let updated = 0;
    for (const ir of inboundReceipts) {
      const totalBoxCount =
        ir.orders?.order_detail?.reduce((s: number, d: { quantity: unknown }) => s + (Number(d?.quantity) || 0), 0) ?? 0;
      const amount = totalBoxCount > BOX_THRESHOLD ? AMOUNT_OVER_1200 : AMOUNT_1200_OR_LESS;

      await prisma.unload_bill.upsert({
        where: { inbound_receipt_id: ir.inbound_receipt_id },
        create: { inbound_receipt_id: ir.inbound_receipt_id, amount },
        update: { amount },
      });
      updated += 1;
    }

    return NextResponse.json({ ok: true, updated });
  } catch (e) {
    console.error('[unload-bills apply-price-by-box]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '按箱数填入价格失败' },
      { status: 500 }
    );
  }
}
