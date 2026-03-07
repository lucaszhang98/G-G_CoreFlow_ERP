import { NextRequest, NextResponse } from 'next/server';
import { checkPermission } from '@/lib/api/helpers';
import prisma from '@/lib/prisma';

const ROLES = ['admin', 'wms_manager', 'tms_manager', 'employee', 'user', 'oms_operator', 'wms_operator'];

/** PATCH 更新拆柜账单（id 为 inbound_receipt_id，按入库单更新金额，无则创建） */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const permissionResult = await checkPermission(ROLES);
    if (permissionResult.error) return permissionResult.error;

    const { id } = await params;
    const inboundReceiptId = BigInt(id);
    const body = await request.json();
    const amount = body.amount != null ? Number(body.amount) : undefined;

    if (amount === undefined) {
      return NextResponse.json({ error: '缺少 amount' }, { status: 400 });
    }

    const existing = await prisma.unload_bill.findUnique({
      where: { inbound_receipt_id: inboundReceiptId },
    });

    const updated = existing
      ? await prisma.unload_bill.update({
          where: { inbound_receipt_id: inboundReceiptId },
          data: { amount },
        })
      : await prisma.unload_bill.create({
          data: { inbound_receipt_id: inboundReceiptId, amount },
        });

    return NextResponse.json({
      data: {
        unload_bill_id: Number(updated.unload_bill_id),
        inbound_receipt_id: Number(updated.inbound_receipt_id),
        amount: Number(updated.amount),
        updated_at: updated.updated_at?.toISOString?.() ?? null,
      },
    });
  } catch (e) {
    console.error('[unload-bills PATCH]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '更新拆柜账单失败' },
      { status: 500 }
    );
  }
}

/** DELETE 删除拆柜账单（id 为 inbound_receipt_id） */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const permissionResult = await checkPermission(ROLES);
    if (permissionResult.error) return permissionResult.error;

    const { id } = await params;
    const inboundReceiptId = BigInt(id);
    await prisma.unload_bill.deleteMany({
      where: { inbound_receipt_id: inboundReceiptId },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[unload-bills DELETE]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '删除拆柜账单失败' },
      { status: 500 }
    );
  }
}
