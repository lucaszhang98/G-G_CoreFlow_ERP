/**
 * 费用归属范围 API：查询 / 设置 scope（指定客户列表）
 * 设置时：把某客户加入当前 fee 的 scope 时，自动从同 fee_code 下其他 fee 的 scope 中移除
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { checkPermission } from '@/lib/api/helpers'
import { serializeBigInt } from '@/lib/api/helpers'
import { feeConfig } from '@/lib/crud/configs/fees'

/**
 * GET /api/finance/fees/[id]/scope
 * 获取该费用下的归属客户列表（scope_type=customers 时）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const permissionResult = await checkPermission(feeConfig.permissions.list)
    if (permissionResult.error) return permissionResult.error

    const { id } = params instanceof Promise ? await params : params
    const feeId = BigInt(id)

    const fee = await prisma.fee.findUnique({
      where: { id: feeId },
      select: { id: true, fee_code: true, scope_type: true },
    })
    if (!fee) {
      return NextResponse.json({ error: '费用不存在' }, { status: 404 })
    }

    const scopeRows = await prisma.fee_scope.findMany({
      where: { fee_id: feeId },
      include: {
        customers: {
          select: { id: true, code: true, name: true },
        },
      },
    })

    return NextResponse.json({
      data: serializeBigInt(scopeRows),
      scope_type: fee.scope_type,
    })
  } catch (error: any) {
    console.error('[GET fee scope]', error)
    return NextResponse.json(
      { error: error?.message || '获取归属范围失败' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/finance/fees/[id]/scope
 * 设置归属客户列表。body: { customer_ids: number[] }
 * 规则：对每个被加入的 customer_id，先从同 fee_code 下其他 fee 的 fee_scope 中删除该客户，再写入当前 fee
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const permissionResult = await checkPermission(feeConfig.permissions.update)
    if (permissionResult.error) return permissionResult.error

    const { id } = params instanceof Promise ? await params : params
    const feeId = BigInt(id)

    const fee = await prisma.fee.findUnique({
      where: { id: feeId },
      select: { id: true, fee_code: true, scope_type: true },
    })
    if (!fee) {
      return NextResponse.json({ error: '费用不存在' }, { status: 404 })
    }
    if (fee.scope_type !== 'customers') {
      return NextResponse.json(
        { error: '仅 scope_type 为「指定客户」的费用可维护归属范围' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const customerIds: number[] = Array.isArray(body.customer_ids)
      ? body.customer_ids.map((x: any) => Number(x)).filter((x: number) => !isNaN(x) && x > 0)
      : []

    const customerIdsBigInt = customerIds.map((x) => BigInt(x))

    await prisma.$transaction(async (tx) => {
      // 1. 同 fee_code 下、非当前 fee 的所有 fee_id
      const otherFees = await tx.fee.findMany({
        where: { fee_code: fee.fee_code, id: { not: feeId } },
        select: { id: true },
      })
      const otherFeeIds = otherFees.map((f) => f.id)

      // 2. 从这些 fee 的 fee_scope 中删除当前要设置的 customer_ids（一个客户只属于同 fee_code 下的一个 fee）
      if (otherFeeIds.length > 0 && customerIdsBigInt.length > 0) {
        await tx.fee_scope.deleteMany({
          where: {
            fee_id: { in: otherFeeIds },
            customer_id: { in: customerIdsBigInt },
          },
        })
      }

      // 3. 替换当前 fee 的 scope：先删后插
      await tx.fee_scope.deleteMany({
        where: { fee_id: feeId },
      })
      if (customerIdsBigInt.length > 0) {
        await tx.fee_scope.createMany({
          data: customerIdsBigInt.map((customer_id) => ({
            fee_id: feeId,
            customer_id,
          })),
          skipDuplicates: true,
        })
      }
    })

    const scopeRows = await prisma.fee_scope.findMany({
      where: { fee_id: feeId },
      include: {
        customers: {
          select: { id: true, code: true, name: true },
        },
      },
    })

    return NextResponse.json({
      data: serializeBigInt(scopeRows),
      message: '归属范围已更新',
    })
  } catch (error: any) {
    console.error('[PUT fee scope]', error)
    return NextResponse.json(
      { error: error?.message || '更新归属范围失败' },
      { status: 500 }
    )
  }
}
