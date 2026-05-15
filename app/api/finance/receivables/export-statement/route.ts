/**
 * GET /api/finance/receivables/export-statement
 * 与应收列表相同的筛选/搜索/高级搜索参数；排除余额为 0 的行；STATEMENT 版式 Excel。
 * Query: 与列表一致；可选 as_of=YYYY-MM-DD（对账单日期，默认当天 UTC）。
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkPermission, parsePaginationParams } from '@/lib/api/helpers'
import { receivableConfig } from '@/lib/crud/configs/receivables'
import prisma from '@/lib/prisma'
import { buildReceivableListWhere } from '@/lib/finance/receivables-list-where-from-params'
import {
  generateReceivableStatementExcel,
  mapReceivableDbRowToStatementRow,
} from '@/lib/utils/receivable-statement-export-excel'

function parseAsOfDate(searchParams: URLSearchParams): Date {
  const raw = searchParams.get('as_of')?.trim()
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d))
  }
  const t = new Date()
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()))
}

export async function GET(request: NextRequest) {
  try {
    const permissionResult = await checkPermission(receivableConfig.permissions.list)
    if (permissionResult.error) return permissionResult.error

    const { searchParams } = new URL(request.url)
    const where = buildReceivableListWhere(receivableConfig, searchParams)

    const { sort, order } = parsePaginationParams(
      searchParams,
      receivableConfig.list.defaultSort || 'due_date',
      (receivableConfig.list.defaultOrder as 'asc' | 'desc') || 'asc'
    )

    const safeSortFields = new Set([
      'due_date',
      'receivable_amount',
      'balance',
      'status',
      'created_at',
      'updated_at',
      'receivable_id',
      'allocated_amount',
      'notes',
    ])
    const sortField = safeSortFields.has(sort) ? sort : 'due_date'

    const rawRows = await prisma.receivables.findMany({
      where,
      take: 50_000,
      orderBy: { [sortField]: order },
      include: {
        invoices: {
          select: {
            invoice_number: true,
            invoice_date: true,
            orders: {
              select: { order_number: true },
            },
          },
        },
        customers: {
          select: {
            id: true,
            code: true,
            name: true,
            company_name: true,
          },
        },
      },
    })

    const nonZero = rawRows.filter((r) => {
      const b = Number(r.balance ?? 0)
      return Number.isFinite(b) && Math.abs(b) > 1e-9
    })

    const customerIds = new Set(nonZero.map((r) => r.customer_id.toString()))
    const showCustomerColumn = customerIds.size > 1

    const statementRows = nonZero.map((r) =>
      mapReceivableDbRowToStatementRow(r as unknown as Record<string, unknown>)
    )

    const totalBalanceDue = statementRows.reduce((s, r) => s + r.balance, 0)

    let billToLines: string[] = ['', '', '']
    let customerIdLabel = ''
    if (customerIds.size === 1) {
      const first = nonZero[0]
      const c = first?.customers
      const line1 = (c?.company_name?.trim() || c?.name?.trim() || c?.code?.trim() || 'Customer') as string
      billToLines = [line1, '', '']
      customerIdLabel = c?.code ? String(c.code) : ''
    } else if (customerIds.size > 1) {
      billToLines = ['（多客户汇总）', '', '']
      customerIdLabel = ''
    }

    const statementDate = parseAsOfDate(searchParams)

    const workbook = await generateReceivableStatementExcel({
      statementDate,
      billToLines,
      customerIdLabel,
      amountDue: totalBalanceDue,
      creditsLabel: '',
      totalBalanceDue,
      rows: statementRows,
      showCustomerColumn,
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const safeName = `STATEMENT_${customerIdLabel || 'export'}_${statementDate.toISOString().slice(0, 10)}`.replace(
      /[^\w\-]+/g,
      '_'
    )

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(safeName)}.xlsx"`,
      },
    })
  } catch (e) {
    console.error('[receivables export-statement]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '导出失败' },
      { status: 500 }
    )
  }
}
