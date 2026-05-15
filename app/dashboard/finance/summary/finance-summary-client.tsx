"use client"

import * as React from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

type MatrixPayload = {
  months: string[]
  rows: Array<{
    customerId: string
    customerCode: string
    customerName: string
    byMonth: Record<string, number>
    rowTotal: number
  }>
  columnTotals: Record<string, number>
  grandTotal: number
}

function formatYmLabel(ym: string): string {
  const [y, m] = ym.split("-")
  if (!y || !m) return ym
  return `${y}年${parseInt(m, 10)}月`
}

function fmtMoney(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function FinanceSummaryClient() {
  const [loading, setLoading] = React.useState(true)
  const [matrix, setMatrix] = React.useState<MatrixPayload | null>(null)

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch("/api/finance/summary/receivables-matrix")
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(typeof body.error === "string" ? body.error : "加载失败")
        }
        if (!cancelled) {
          setMatrix(body.data ?? null)
        }
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "加载失败")
          setMatrix(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>应收余额按月汇总</CardTitle>
        <CardDescription>
          仅包含当前仍有余额（余额大于 0）的应收；列按关联发票的开票日期所在自然月汇总余额；若无开票日则使用应收到期日所在月。列为从最早到最晚月份的连续区间。
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span>加载中…</span>
          </div>
        ) : !matrix || matrix.rows.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center">当前没有仍有余额的应收记录。</p>
        ) : (
          <div className="w-full overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 min-w-[140px] bg-card shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                    客户
                  </TableHead>
                  {matrix.months.map((ym) => (
                    <TableHead key={ym} className="whitespace-nowrap text-right min-w-[100px]">
                      {formatYmLabel(ym)}
                    </TableHead>
                  ))}
                  <TableHead className="whitespace-nowrap text-right min-w-[110px] font-semibold">
                    合计
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matrix.rows.map((row) => (
                  <TableRow key={row.customerId}>
                    <TableCell className="sticky left-0 z-10 bg-card font-medium shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                      <div className="flex flex-col gap-0.5">
                        <span>{row.customerCode}</span>
                        <span className="text-xs text-muted-foreground font-normal">{row.customerName}</span>
                      </div>
                    </TableCell>
                    {matrix.months.map((ym) => {
                      const v = row.byMonth[ym] ?? 0
                      return (
                        <TableCell key={ym} className="text-right tabular-nums">
                          {v > 0 ? fmtMoney(v) : "—"}
                        </TableCell>
                      )
                    })}
                    <TableCell className="text-right tabular-nums font-medium">{fmtMoney(row.rowTotal)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell className="sticky left-0 z-10 bg-muted/50">列合计</TableCell>
                  {matrix.months.map((ym) => (
                    <TableCell key={ym} className="text-right tabular-nums">
                      {fmtMoney(matrix.columnTotals[ym] ?? 0)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right tabular-nums">{fmtMoney(matrix.grandTotal)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
