/**
 * POST 批量核销：同一事务内创建多条 payment_allocations 并回写各应收
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { checkPermission, serializeBigInt } from '@/lib/api/helpers'
import { paymentConfig } from '@/lib/crud/configs/payments'
import { deriveReceivableBalanceAndStatus } from '@/lib/finance/invoice-receivable-sync'
import { syncPaymentWriteOffById } from '@/lib/finance/payment-write-off-sync'

type Item = { receivable_id: string | number; allocated_amount: number }

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const permissionResult = await checkPermission(paymentConfig.permissions.update)
    if (permissionResult.error) return permissionResult.error
    const userId = permissionResult.user?.id ? BigInt(permissionResult.user.id) : null

    const { id } = await params
    const paymentId = BigInt(id)

    const body = await request.json()
    const items = body?.items as Item[] | undefined
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: '请提供 items 数组' }, { status: 400 })
    }

    const seenRecv = new Set<string>()
    let batchTotal = 0
    for (const it of items) {
      const rid = it?.receivable_id
      const amt = Number(it?.allocated_amount)
      if (rid == null || Number.isNaN(amt) || amt <= 0) {
        return NextResponse.json({ error: '每条需包含 receivable_id 与大于 0 的 allocated_amount' }, { status: 400 })
      }
      const key = String(rid)
      if (seenRecv.has(key)) {
        return NextResponse.json({ error: '同一应收不能在同一批次中重复' }, { status: 400 })
      }
      seenRecv.add(key)
      batchTotal += amt
    }

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payments.findUnique({
        where: { payment_id: paymentId },
        select: { customer_id: true, amount: true },
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
      if (already + batchTotal > cap + 1e-6) {
        throw new Error(
          `核销合计不能超过收款剩余可分配金额（收款 ${cap.toFixed(2)}，已分配 ${already.toFixed(2)}，本次合计 ${batchTotal.toFixed(2)}）`
        )
      }

      const created: unknown[] = []

      for (const it of items) {
        const receivableId = BigInt(String(it.receivable_id))
        const want = Number(it.allocated_amount)

        const receivable = await tx.receivables.findUnique({
          where: { receivable_id: receivableId },
          select: {
            receivable_id: true,
            customer_id: true,
            receivable_amount: true,
            allocated_amount: true,
            balance: true,
          },
        })
        if (!receivable) {
          throw new Error(`应收不存在: ${receivableId}`)
        }
        if (receivable.customer_id !== payment.customer_id) {
          throw new Error('应收与收款客户不一致')
        }

        const bal =
          receivable.balance != null
            ? Number(receivable.balance)
            : Number(receivable.receivable_amount) - Number(receivable.allocated_amount ?? 0)
        if (bal <= 1e-6) {
          throw new Error(`应收 ${receivableId} 已无余额`)
        }
        const apply = Math.min(want, bal)

        const existing = await tx.payment_allocations.findUnique({
          where: {
            payment_id_receivable_id: { payment_id: paymentId, receivable_id: receivableId },
          },
        })
        if (existing) {
          throw new Error(`该收款已对发票对应应收核销过，请先调整原记录`)
        }

        const row = await tx.payment_allocations.create({
          data: {
            payment_id: paymentId,
            receivable_id: receivableId,
            allocated_amount: apply,
            created_by: userId,
          },
        })

        const prevAlloc = Number(receivable.allocated_amount ?? 0)
        const newAllocated = prevAlloc + apply
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

        created.push(row)
      }

      await syncPaymentWriteOffById(tx, paymentId)

      return created
    })

    return NextResponse.json({
      data: serializeBigInt(result),
      message: '核销成功',
    }, { status: 201 })
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: '收款记录不存在' }, { status: 404 })
    }
    console.error('[POST allocations batch]', error)
    return NextResponse.json(
      { error: error?.message || '批量核销失败' },
      { status: 400 }
    )
  }
}
