/**
 * GET /api/finance/fees/[id]/invoice-lines-export
 * 导出本费用在账单明细中的全部引用记录（Excel）
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { checkPermission } from '@/lib/api/helpers'
import { feeConfig } from '@/lib/crud/configs/fees'
import { getFeeInvoiceLinesUsage } from '@/lib/finance/fee-invoice-line-usage'
import { generateFeeInvoiceLinesExcel } from '@/lib/utils/fee-invoice-lines-export-excel'

function safeFilenamePart(s: string): string {
  return s.replace(/[^\w\u4e00-\u9fa5.-]+/g, '_').slice(0, 80) || 'fee'
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const permissionResult = await checkPermission(feeConfig.permissions.list)
    if (permissionResult.error) return permissionResult.error

    const { id } = await params
    let feeId: bigint
    try {
      feeId = BigInt(id)
    } catch {
      return NextResponse.json({ error: '无效的费用 ID' }, { status: 400 })
    }

    const { fee, rows } = await getFeeInvoiceLinesUsage(prisma, feeId)
    if (!fee) {
      return NextResponse.json({ error: '费用不存在' }, { status: 404 })
    }

    const buffer = await generateFeeInvoiceLinesExcel({
      feeCode: fee.fee_code,
      feeName: fee.fee_name,
      rows,
    })

    const name = `费用-${safeFilenamePart(fee.fee_code)}-核销明细.xlsx`
    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      },
    })
  } catch (error: unknown) {
    console.error('[GET fee invoice-lines-export]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '导出失败' },
      { status: 500 }
    )
  }
}
