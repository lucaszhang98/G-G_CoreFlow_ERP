/**
 * 收款核销 API：按收款 ID 查询核销明细、创建单笔核销
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { checkPermission, serializeBigInt } from '@/lib/api/helpers'
import { paymentConfig } from '@/lib/crud/configs/payments'
import { deriveReceivableBalanceAndStatus } from '@/lib/finance/invoice-receivable-sync'

function receivableOpenBalance(r: {
  receivable_amount: unknown
  allocated_amount: unknown | null
  balance: unknown | null
}): number {
  if (r.balance != null && r.balance !== '') {
    return Number(r.balance)
  }
  return Number(r.receivable_amount) - Number(r.allocated_amount ?? 0)
}

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
      orderBy: { id: 'asc' },
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
 * 单笔核销：校验收款剩余额度，回写应收 allocated / balance / status
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

    const userId = currentUser?.id ? BigInt(currentUser.id) : null

    const withRelations = await prisma.$transaction(async (tx) => {
      const payment = await tx.payments.findUnique({
        where: { payment_id: paymentId },
        select: { payment_id: true, customer_id: true, amount: true },
      })
      if (!payment) {
        const err = new Error('NOT_FOUND') as Error & { code: string }
        err.code = 'P2025'
        throw err
      }

      const sumAgg = await tx.payment_allocations.aggregate({
        where: { payment_id: paymentId },
        _sum: { allocated_amount: true },
      })
      const already = Number(sumAgg._sum.allocated_amount ?? 0)
      const cap = Number(payment.amount)
      if (already + allocatedAmount > cap + 1e-6) {
        throw new Error(
          `核销金额不能超过收款剩余可分配（收款 ${cap.toFixed(2)}，已分配 ${already.toFixed(2)}，本次最多 ${(cap - already).toFixed(2)}）`
        )
      }

      const receivable = await tx.receivables.findUnique({
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
        throw new Error('应收记录不存在')
      }

      if (receivable.customer_id !== payment.customer_id) {
        throw new Error('该应收与当前收款不属于同一客户，无法核销')
      }

      const currentBalance = receivableOpenBalance(receivable)
      if (currentBalance <= 1e-6) {
        throw new Error('该应收已无余额，无法核销')
      }

      const amountToAllocate = Math.min(allocatedAmount, currentBalance)

      const existing = await tx.payment_allocations.findUnique({
        where: {
          payment_id_receivable_id: { payment_id: paymentId, receivable_id: receivableId },
        },
      })
      if (existing) {
        throw new Error('DUPLICATE')
      }

      const created = await tx.payment_allocations.create({
        data: {
          payment_id: paymentId,
          receivable_id: receivableId,
          allocated_amount: amountToAllocate,
          created_by: userId,
        },
      })

      const newAllocated = Number(receivable.allocated_amount ?? 0) + amountToAllocate
      const { balance, status } = deriveReceivableBalanceAndStatus(
        receivable.receivable_amount,
        newAllocated
      )

      await tx.receivables.update({
        where: { receivable_id: receivableId },
        data: {
          allocated_amount: newAllocated,
          balance,
          status,
          updated_at: new Date(),
          updated_by: userId,
        },
      })

      return tx.payment_allocations.findUnique({
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
    })

    return NextResponse.json({
      data: serializeBigInt(withRelations),
      message: '核销成功',
    }, { status: 201 })
  } catch (error: any) {
    if (error?.message === 'DUPLICATE') {
      return NextResponse.json(
        { error: '该收款已对该应收做过核销，请修改原核销记录或选择其他应收' },
        { status: 409 }
      )
    }
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: '收款记录不存在' }, { status: 404 })
    }
    console.error('[POST payments allocations]', error)
    return NextResponse.json(
      { error: error?.message || '核销失败' },
      { status: 400 }
    )
  }
}
