"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { PaymentWriteOffDialog } from "@/components/finance/payment-writeoff-dialog"

interface PaymentAllocationsCardProps {
  paymentId: string
}

interface AllocationRow {
  id: string | number
  allocated_amount: number
  receivables: {
    receivable_id: string | number
    receivable_amount?: number
    balance?: number
    allocated_amount?: number
    invoices?: { invoice_number: string; total_amount?: number }
    customers?: { code: string; name: string }
  }
}

interface PaymentHead {
  customer_id: string | number
  amount: number
}

export function PaymentAllocationsCard({ paymentId }: PaymentAllocationsCardProps) {
  const [payment, setPayment] = useState<PaymentHead | null>(null)
  const [allocations, setAllocations] = useState<AllocationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [writeOffOpen, setWriteOffOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const fetchPayment = useCallback(async () => {
    try {
      const res = await fetch(`/api/finance/payments/${paymentId}`)
      if (!res.ok) return null
      const json = await res.json()
      const row = json.data || json
      if (!row) return null
      return {
        customer_id: row.customer_id,
        amount: Number(row.amount),
      } as PaymentHead
    } catch {
      return null
    }
  }, [paymentId])

  const fetchAllocations = useCallback(async () => {
    try {
      const res = await fetch(`/api/finance/payments/${paymentId}/allocations`)
      if (!res.ok) return []
      const json = await res.json()
      return (json.data || []) as AllocationRow[]
    } catch {
      return []
    }
  }, [paymentId])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const pay = await fetchPayment()
    if (!pay) {
      setError("无法加载收款信息")
      setPayment(null)
      setAllocations([])
      setLoading(false)
      return
    }
    setPayment(pay)
    const allocs = await fetchAllocations()
    setAllocations(allocs)
    setLoading(false)
  }, [fetchPayment, fetchAllocations])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const allocatedTotal = useMemo(
    () =>
      allocations.reduce(
        (s, row) => s + Number(row.allocated_amount ?? 0),
        0
      ),
    [allocations]
  )

  const remaining = useMemo(() => {
    if (!payment) return 0
    return Math.max(0, Number(payment.amount) - allocatedTotal)
  }, [payment, allocatedTotal])

  const handleExportExcel = async () => {
    setExporting(true)
    try {
      const res = await fetch(
        `/api/finance/payments/${paymentId}/allocations-export`
      )
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(typeof j.error === "string" ? j.error : "导出失败")
      }
      const blob = await res.blob()
      const cd = res.headers.get("Content-Disposition")
      let filename = `收款-${paymentId}-核销明细.xlsx`
      const m = cd?.match(/filename\*=UTF-8''(.+)/i)
      if (m?.[1]) {
        try {
          filename = decodeURIComponent(m[1])
        } catch {
          /* keep default */
        }
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      toast.success("已开始下载")
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "导出失败")
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>核销明细</CardTitle>
          <CardDescription>该笔收款冲抵的应收记录</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <PaymentWriteOffDialog
        open={writeOffOpen}
        onOpenChange={setWriteOffOpen}
        paymentId={paymentId}
        onSuccess={() => void refresh()}
      />
      <Card className="border-0 shadow-lg">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>核销明细</CardTitle>
            <CardDescription>
              已分配金额从本收款核销累加；剩余可继续消账。
            </CardDescription>
          </div>
          {payment && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleExportExcel()}
                disabled={exporting}
              >
                {exporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    导出中…
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    导出 Excel
                  </>
                )}
              </Button>
              <Button
                type="button"
                onClick={() => setWriteOffOpen(true)}
                disabled={remaining <= 1e-6}
                title={remaining <= 1e-6 ? "收款已全部核销，无可再分配金额" : undefined}
              >
                消账
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
              {error}
            </p>
          )}

          {payment && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm rounded-md border bg-muted/30 p-3">
              <div>
                <span className="text-muted-foreground">收款金额</span>
                <p className="font-semibold tabular-nums">
                  {Number(payment.amount).toFixed(2)} USD
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">已核销合计</span>
                <p className="font-semibold tabular-nums">
                  {allocatedTotal.toFixed(2)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">剩余可分配</span>
                <p className="font-semibold tabular-nums">
                  {remaining.toFixed(2)}
                </p>
              </div>
            </div>
          )}

          {allocations.length > 0 ? (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-2 font-medium">发票号</th>
                    <th className="text-right p-2 font-medium">应收金额</th>
                    <th className="text-right p-2 font-medium">应收余额</th>
                    <th className="text-right p-2 font-medium">本笔核销</th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.map((row) => {
                    const inv = row.receivables?.invoices
                    const recv = row.receivables
                    const recvAmt = Number(recv?.receivable_amount ?? 0)
                    const bal = Number(
                      recv?.balance ??
                        recvAmt - Number(recv?.allocated_amount ?? 0)
                    )
                    return (
                      <tr key={String(row.id)} className="border-b last:border-0">
                        <td className="p-2">
                          {inv?.invoice_number ??
                            `应收 #${recv?.receivable_id ?? row.id}`}
                        </td>
                        <td className="p-2 text-right tabular-nums">
                          {recvAmt.toFixed(2)}
                        </td>
                        <td className="p-2 text-right tabular-nums">
                          {bal.toFixed(2)}
                        </td>
                        <td className="p-2 text-right tabular-nums font-medium">
                          {Number(row.allocated_amount).toFixed(2)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">暂无核销记录</p>
          )}
        </CardContent>
      </Card>
    </>
  )
}
