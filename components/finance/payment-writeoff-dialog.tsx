'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'

type ReceivableRow = {
  receivable_id: string
  invoice_id: string | null
  invoice_number: string | null
  receivable_amount: string | number
  allocated_amount: string | number
  balance: string | number
  status?: string | null
}

type WriteOffContext = {
  payment: {
    payment_id: string
    customer_id: string
    amount: string | number
    currency: string | null
  }
  allocated_total: number
  remaining: number
  receivables: ReceivableRow[]
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  paymentId: string
  onSuccess?: () => void
}

export function PaymentWriteOffDialog({
  open,
  onOpenChange,
  paymentId,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [ctx, setCtx] = useState<WriteOffContext | null>(null)
  const [invoiceFilter, setInvoiceFilter] = useState('')
  const [amounts, setAmounts] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    if (!paymentId) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/finance/payments/${paymentId}/write-off-context`
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json.error || '加载失败')
      }
      const d = json.data as {
        payment: {
          payment_id: string | number
          customer_id: string | number
          amount: string | number
          currency: string | null
          allocated_total?: string | number
          remaining?: string | number
        }
        open_receivables: ReceivableRow[]
      }
      if (!d?.payment) {
        throw new Error('无效响应')
      }
      const p = d.payment
      setCtx({
        payment: {
          payment_id: String(p.payment_id),
          customer_id: String(p.customer_id),
          amount: p.amount,
          currency: p.currency,
        },
        allocated_total: Number(p.allocated_total ?? 0),
        remaining: Number(p.remaining ?? 0),
        receivables: (d.open_receivables || []).map((r) => ({
          ...r,
          receivable_id: String(r.receivable_id),
          invoice_id: r.invoice_id != null ? String(r.invoice_id) : null,
        })),
      })
      setAmounts({})
      setInvoiceFilter('')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '加载失败')
      setCtx(null)
    } finally {
      setLoading(false)
    }
  }, [paymentId])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const filteredReceivables = useMemo(() => {
    const list = ctx?.receivables ?? []
    const q = invoiceFilter.trim().toLowerCase()
    if (!q) return list
    return list.filter((r) =>
      (r.invoice_number || '').toLowerCase().includes(q)
    )
  }, [ctx?.receivables, invoiceFilter])

  const setAmount = (receivableId: string, value: string) => {
    setAmounts((prev) => ({ ...prev, [receivableId]: value }))
  }

  const parseNum = (s: string) => {
    const n = Number(String(s).replace(/,/g, '').trim())
    return Number.isFinite(n) ? n : NaN
  }

  const handleSubmit = async () => {
    if (!ctx) return
    const items: { receivable_id: string; allocated_amount: number }[] = []
    for (const r of ctx.receivables) {
      const raw = amounts[r.receivable_id]
      if (raw == null || String(raw).trim() === '') continue
      const n = parseNum(String(raw))
      if (!Number.isFinite(n) || n <= 0) {
        toast.error('请填写有效的核销金额（大于 0）')
        return
      }
      items.push({ receivable_id: r.receivable_id, allocated_amount: n })
    }
    if (items.length === 0) {
      toast.error('请至少填写一条核销金额')
      return
    }

    const batchTotal = items.reduce((s, it) => s + it.allocated_amount, 0)
    const cap = ctx.remaining
    const cur = ctx.payment.currency || 'USD'
    if (batchTotal > cap + 1e-6) {
      const over = batchTotal - cap
      toast.error(
        `本次核销合计 ${batchTotal.toFixed(2)} ${cur}，超过剩余可分配 ${cap.toFixed(2)} ${cur}，超出 ${over.toFixed(2)} ${cur}。请调低金额后重试。`
      )
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(
        `/api/finance/payments/${paymentId}/allocations/batch`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        }
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json.error || '核销失败')
      }
      toast.success(json.message || '核销成功')
      onOpenChange(false)
      onSuccess?.()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '核销失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>消账</DialogTitle>
          <DialogDescription>
            选择该客户仍有余额的应收，按发票号筛选后填写核销金额。已分配总额不得超过收款金额。
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            加载中…
          </div>
        ) : ctx ? (
          <div className="space-y-3 min-h-0 flex-1 flex flex-col">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">收款金额：</span>
                <span className="font-medium">
                  {Number(ctx.payment.amount).toFixed(2)}{' '}
                  {ctx.payment.currency || 'USD'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">已分配 / 剩余：</span>
                <span className="font-medium">
                  {ctx.allocated_total.toFixed(2)} / {ctx.remaining.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoice-filter">发票号筛选</Label>
              <Input
                id="invoice-filter"
                placeholder="输入发票号关键字"
                value={invoiceFilter}
                onChange={(e) => setInvoiceFilter(e.target.value)}
              />
            </div>
            <ScrollArea className="h-[min(360px,45vh)] border rounded-md">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">发票号</th>
                    <th className="text-right p-2 font-medium">应收</th>
                    <th className="text-right p-2 font-medium">已核销</th>
                    <th className="text-right p-2 font-medium">余额</th>
                    <th className="text-right p-2 font-medium w-[120px]">
                      本次核销
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReceivables.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-6 text-center text-muted-foreground"
                      >
                        没有符合条件的未结清应收
                      </td>
                    </tr>
                  ) : (
                    filteredReceivables.map((r) => (
                      <tr key={r.receivable_id} className="border-b last:border-0">
                        <td className="p-2">
                          {r.invoice_number || '—'}
                        </td>
                        <td className="p-2 text-right tabular-nums">
                          {Number(r.receivable_amount).toFixed(2)}
                        </td>
                        <td className="p-2 text-right tabular-nums">
                          {Number(r.allocated_amount).toFixed(2)}
                        </td>
                        <td className="p-2 text-right tabular-nums">
                          {Number(r.balance).toFixed(2)}
                        </td>
                        <td className="p-2">
                          <Input
                            className="h-8 text-right tabular-nums"
                            placeholder="0"
                            value={amounts[r.receivable_id] ?? ''}
                            onChange={(e) =>
                              setAmount(r.receivable_id, e.target.value)
                            }
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        ) : (
          <div className="py-6 text-center text-muted-foreground text-sm">
            无法加载数据
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            取消
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={loading || submitting || !ctx}
          >
            {submitting ? '提交中…' : '确认核销'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
