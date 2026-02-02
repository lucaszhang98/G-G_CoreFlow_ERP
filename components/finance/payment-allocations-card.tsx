"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"

interface PaymentAllocationsCardProps {
  paymentId: string
}

interface AllocationRow {
  id: string | number
  allocated_amount: number
  receivables: {
    receivable_id: string | number
    receivable_amount: number
    balance?: number
    allocated_amount?: number
    invoices?: { invoice_number: string; total_amount: number }
    customers?: { code: string; name: string }
  }
}

interface ReceivableOption {
  receivable_id: string | number
  receivable_amount: number
  balance?: number
  allocated_amount?: number
  invoice_id?: string | number
  invoices?: { invoice_number: string }
}

export function PaymentAllocationsCard({ paymentId }: PaymentAllocationsCardProps) {
  const [payment, setPayment] = useState<{ customer_id: string | number; amount: number } | null>(null)
  const [allocations, setAllocations] = useState<AllocationRow[]>([])
  const [receivables, setReceivables] = useState<ReceivableOption[]>([])
  const [loading, setLoading] = useState(true)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formReceivableId, setFormReceivableId] = useState<string>("")
  const [formAmount, setFormAmount] = useState<string>("")

  const fetchPayment = async () => {
    try {
      const res = await fetch(`/api/finance/payments/${paymentId}`)
      if (!res.ok) return null
      const json = await res.json()
      return json.data || json
    } catch {
      return null
    }
  }

  const fetchAllocations = async () => {
    try {
      const res = await fetch(`/api/finance/payments/${paymentId}/allocations`)
      if (!res.ok) return []
      const json = await res.json()
      return json.data || []
    } catch {
      return []
    }
  }

  const fetchReceivables = async (customerId: string | number) => {
    try {
      const res = await fetch(
        `/api/finance/receivables?filter_customer_id=${customerId}&limit=200`
      )
      if (!res.ok) return []
      const json = await res.json()
      const list = json.data || json.items || []
      return list
    } catch {
      return []
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      const pay = await fetchPayment()
      if (cancelled) return
      if (!pay) {
        setError("无法加载收款信息")
        setLoading(false)
        return
      }
      setPayment(pay)
      const [allocs, recvs] = await Promise.all([
        fetchAllocations(),
        fetchReceivables(pay.customer_id),
      ])
      if (cancelled) return
      setAllocations(allocs)
      setReceivables(recvs)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [paymentId])

  const openReceivables = receivables.filter((r) => {
    const amt = Number(r.receivable_amount)
    const allocated = Number(r.allocated_amount ?? 0)
    const balance = Number(r.balance ?? amt - allocated)
    return balance > 0
  })

  const handleAddAllocation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formReceivableId || !formAmount || Number(formAmount) <= 0) {
      setError("请选择应收并填写核销金额（大于 0）")
      return
    }
    setSubmitLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/finance/payments/${paymentId}/allocations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receivable_id: formReceivableId,
          allocated_amount: Number(formAmount),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || "核销失败")
        setSubmitLoading(false)
        return
      }
      setFormReceivableId("")
      setFormAmount("")
      const allocs = await fetchAllocations()
      setAllocations(allocs)
      const pay = payment
      if (pay) {
        const recvs = await fetchReceivables(pay.customer_id)
        setReceivables(recvs)
      }
    } catch (err: any) {
      setError(err?.message || "核销失败")
    } finally {
      setSubmitLoading(false)
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
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle>核销明细</CardTitle>
        <CardDescription>该笔收款冲抵的应收记录；下方可添加核销</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
            {error}
          </p>
        )}

        {allocations.length > 0 ? (
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2 font-medium">发票号</th>
                  <th className="text-right p-2 font-medium">核销金额</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((row) => (
                  <tr key={String(row.id)} className="border-b last:border-0">
                    <td className="p-2">
                      {row.receivables?.invoices?.invoice_number ?? `应收 #${row.receivables?.receivable_id ?? row.id}`}
                    </td>
                    <td className="p-2 text-right">
                      ${Number(row.allocated_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">暂无核销记录</p>
        )}

        {payment && openReceivables.length > 0 && (
          <form onSubmit={handleAddAllocation} className="space-y-4 pt-2 border-t">
            <p className="text-sm font-medium">添加核销</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>选择应收</Label>
                <Select value={formReceivableId} onValueChange={setFormReceivableId}>
                  <SelectTrigger>
                    <SelectValue placeholder="请选择应收" />
                  </SelectTrigger>
                  <SelectContent>
                    {openReceivables.map((r) => {
                      const amt = Number(r.receivable_amount)
                      const allocated = Number(r.allocated_amount ?? 0)
                      const balance = amt - allocated
                      const label = r.invoices?.invoice_number
                        ? `发票 ${r.invoices.invoice_number}（余额 $${balance.toFixed(2)}）`
                        : `应收 #${r.receivable_id}（余额 $${balance.toFixed(2)}）`
                      return (
                        <SelectItem key={String(r.receivable_id)} value={String(r.receivable_id)}>
                          {label}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>核销金额</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                />
              </div>
            </div>
            <Button type="submit" disabled={submitLoading}>
              {submitLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  提交中
                </>
              ) : (
                "添加核销"
              )}
            </Button>
          </form>
        )}

        {payment && openReceivables.length === 0 && allocations.length >= 0 && (
          <p className="text-sm text-muted-foreground">该客户暂无未结清应收，或已全部核销</p>
        )}
      </CardContent>
    </Card>
  )
}
