/**
 * 费用批量调价：预览 / 提交（同一筛选条件，立即生效；写入 fee.updated_by / updated_at）
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { checkPermission, serializeBigInt } from '@/lib/api/helpers'
import { feeConfig } from '@/lib/crud/configs/fees'
import {
  applyBatchFeeUnitPrice,
  queryFeesForBatchPriceUpdate,
} from '@/lib/finance/batch-update-fee-price'

const bodySchema = z
  .object({
    action: z.enum(['preview', 'apply']),
    all_customers: z.boolean(),
    customer_ids: z.array(z.union([z.string(), z.number()])).optional().default([]),
    container_type: z.string().min(1, '请选择柜型'),
    /** 向导第二步选中后：按费用编码精确匹配范围内所有行 */
    fee_code: z.string().optional(),
    /** 未传 fee_code 时可用关键字模糊匹配（兼容旧调用） */
    fee_name_search: z.string().optional(),
    new_unit_price: z.number().finite().nonnegative().optional(),
  })
  .superRefine((val, ctx) => {
    const fc = val.fee_code?.trim() ?? ''
    const fs = val.fee_name_search?.trim() ?? ''
    if (!fc && !fs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '请选择费用（费用编码）或填写费用关键字',
        path: ['fee_code'],
      })
    }
  })

function toBigIntIds(raw: (string | number | bigint)[]): bigint[] {
  const out: bigint[] = []
  const seen = new Set<string>()
  for (const x of raw) {
    try {
      const b = typeof x === 'bigint' ? x : BigInt(String(x))
      const k = b.toString()
      if (seen.has(k)) continue
      seen.add(k)
      out.push(b)
    } catch {
      // skip invalid
    }
  }
  return out
}

export async function POST(request: NextRequest) {
  const perm = await checkPermission(feeConfig.permissions.update)
  if (perm.error) return perm.error

  const session = await auth()
  const userId = session?.user?.id ? BigInt(session.user.id) : null

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: '请求体无效' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors
    return NextResponse.json(
      { error: Object.values(msg).flat().join('；') || '参数无效' },
      { status: 400 }
    )
  }

  const {
    action,
    all_customers,
    customer_ids,
    container_type,
    fee_code,
    fee_name_search,
    new_unit_price,
  } = parsed.data

  if (action === 'apply' && new_unit_price === undefined) {
    return NextResponse.json({ error: '提交时必须提供 new_unit_price' }, { status: 400 })
  }

  const customerIds = toBigIntIds(customer_ids as (string | number)[])

  try {
    const fc = fee_code?.trim()
    const rows = await queryFeesForBatchPriceUpdate({
      allCustomers: all_customers,
      customerIds,
      containerTypeInput: container_type,
      feeCodeExact: fc ? fc : undefined,
      feeNameSearch: fc ? undefined : (fee_name_search ?? '').trim() || undefined,
    })

    const ids = rows.map((r) => r.id)

    if (action === 'preview') {
      const sample = rows.slice(0, 100).map((r) => ({
        id: r.id,
        fee_code: r.fee_code,
        fee_name: r.fee_name,
        unit_price: Number(r.unit_price),
        currency: r.currency,
        scope_type: r.scope_type,
        container_type: r.container_type,
        customer_id: r.customer_id,
        customer_code: r.customers?.code ?? null,
        customer_name: r.customers?.name ?? null,
      }))
      return NextResponse.json({
        count: rows.length,
        sample: serializeBigInt(sample),
      })
    }

    const count = await applyBatchFeeUnitPrice(ids, new_unit_price!, userId)

    console.log(
      JSON.stringify({
        type: 'fee_batch_price_update',
        actor_user_id: userId?.toString() ?? null,
        updated_count: count,
        matched_fee_count: ids.length,
        all_customers,
        customer_ids: customerIds.map((c) => c.toString()),
        container_type,
        fee_code: fc || null,
        fee_name_search: fee_name_search ?? null,
        new_unit_price,
        sample_fee_ids: ids.slice(0, 30).map((id) => id.toString()),
      })
    )

    return NextResponse.json({
      success: true,
      updated_count: count,
      matched_count: ids.length,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '操作失败'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
