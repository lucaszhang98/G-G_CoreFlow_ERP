/**
 * 收款核销 API：按收款 ID 查询核销明细、创建核销
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { checkPermission } from '@/lib/api/helpers'
import { serializeBigInt } from '@/lib/api/helpers'
import { paymentConfig } from '@/lib/crud/configs/payments'

/**
 * GET /api/finance/payments/[id]/allocations
 * 获取该笔收款下的所有核销记录（含应收、发票信息）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const permissionResult = await checkPermission(paymentConfig.permissions.list)
    if (permissionResult.error) return permissionResult.error

    const { id } = await params
    const paymentId = BigInt(id)

    const allocations = await prisma.payment_allocations.findMany({
      where: { payment_id: paymentId },
      include: {
        receivables: {
          include: {
            invoices: { select: { invoice_number: true, total_amount: true } },
            customers: { select: { code: true, name: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    })

    return NextResponse.json({
      data: serializeBigInt(allocations),
    })
  } catch (error: any) {
    console.error('[GET payments allocations]', error)
    return NextResponse.json(
      { error: error?.message || '获取核销明细失败' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/finance/payments/[id]/allocations
 * 创建核销：指定应收与核销金额，并回写应收的已核销与余额
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const permissionResult = await checkPermission(paymentConfig.permissions.update)
    if (permissionResult.error) return permissionResult.error
    const currentUser = permissionResult.user

    const { id } = await params
    const paymentId = BigInt(id)

    const body = await request.json()
    const receivableId = body.receivable_id != null ? BigInt(body.receivable_id) : null
    const allocatedAmount = body.allocated_amount != null ? Number(body.allocated_amount) : null

    if (!receivableId || allocatedAmount == null || allocatedAmount <= 0) {
      return NextResponse.json(
        { error: '请填写应收 ID 与核销金额（大于 0）' },
        { status: 400 }
      )
    }

    const payment = await prisma.payments.findUnique({
      where: { payment_id: paymentId },
      select: { payment_id: true, customer_id: true, amount: true },
    })
    if (!payment) {
      return NextResponse.json({ error: '收款记录不存在' }, { status: 404 })
    }

    const receivable = await prisma.receivables.findUnique({
      where: { receivable_id: receivableId },
      select: {
        receivable_id: true,
        customer_id: true,
        receivable_amount: true,
        allocated_amount: true,
        balance: true,
        status: true,
      },
    })
    if (!receivable) {
      return NextResponse.json({ error: '应收记录不存在' }, { status: 404 })
    }

    if (receivable.customer_id !== payment.customer_id) {
      return NextResponse.json({ error: '该应收与当前收款不属于同一客户，无法核销' }, { status: 400 })
    }

    const currentBalance = Number(receivable.receivable_amount) - Number(receivable.allocated_amount ?? 0)
    if (currentBalance <= 0) {
      return NextResponse.json({ error: '该应收已无余额，无法核销' }, { status: 400 })
    }

    const amountToAllocate = Math.min(allocatedAmount, currentBalance)

    const existing = await prisma.payment_allocations.findUnique({
      where: {
        payment_id_receivable_id: { payment_id: paymentId, receivable_id: receivableId },
      },
    })
    if (existing) {
      return NextResponse.json(
        { error: '该收款已对该应收做过核销，请修改原核销记录或选择其他应收' },
        { status: 409 }
      )
    }

    const created = await prisma.payment_allocations.create({
      data: {
        payment_id: paymentId,
        receivable_id: receivableId,
        allocated_amount: amountToAllocate,
        created_by: currentUser?.id ? BigInt(currentUser.id) : null,
      },
    })

    const newAllocated = Number(receivable.allocated_amount ?? 0) + amountToAllocate
    const newBalance = Number(receivable.receivable_amount) - newAllocated
    const newStatus = newBalance <= 0 ? 'closed' : 'partial'

    await prisma.receivables.update({
      where: { receivable_id: receivableId },
      data: {
        allocated_amount: newAllocated,
        balance: newBalance,
        status: newStatus,
        updated_at: new Date(),
        updated_by: currentUser?.id ? BigInt(currentUser.id) : null,
      },
    })

    const withRelations = await prisma.payment_allocations.findUnique({
      where: { id: created.id },
      include: {
        receivables: {
          include: {
            invoices: { select: { invoice_number: true, total_amount: true } },
            customers: { select: { code: true, name: true } },
          },
        },
      },
    })

    return NextResponse.json({
      data: serializeBigInt(withRelations),
      message: '核销成功',
    }, { status: 201 })
  } catch (error: any) {
    console.error('[POST payments allocations]', error)
    return NextResponse.json(
      { error: error?.message || '核销失败' },
      { status: 500 }
    )
  }
}
