"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FuzzySearchSelect, type FuzzySearchOption } from "@/components/ui/fuzzy-search-select"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

const schema = z.object({
  customer_id: z.string().min(1, "请选择客户"),
  payment_date: z.string().min(1, "请选择收款日期"),
  amount: z
    .string()
    .min(1, "请输入金额")
    .refine((s) => {
      const n = Number(String(s).replace(/,/g, "").trim())
      return Number.isFinite(n) && n >= 0
    }, "金额不能小于 0"),
  bank_reference: z.string().max(100).optional(),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

async function loadCustomerOptions(search: string): Promise<FuzzySearchOption[]> {
  const params = new URLSearchParams()
  params.set("unlimited", "true")
  if (search) params.set("search", search)
  const res = await fetch(`/api/customers?${params.toString()}`)
  if (!res.ok) throw new Error("加载客户失败")
  const data = await res.json()
  const list = data.data ?? data.items ?? []
  return list.map((c: { id: number; code?: string; name?: string }) => ({
    value: c.id,
    label: [c.code, c.name].filter(Boolean).join(" ") || String(c.id),
  }))
}

function todayDateString() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export type NewPaymentFormProps = {
  onCreated: (paymentId: string) => void
  onCancel: () => void
}

export function NewPaymentForm({ onCreated, onCancel }: NewPaymentFormProps) {
  const [submitting, setSubmitting] = React.useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      payment_date: todayDateString(),
      amount: "0",
    },
  })

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true)
    try {
      const res = await fetch("/api/finance/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: Number(values.customer_id),
          payment_date: values.payment_date,
          amount: Number(String(values.amount).replace(/,/g, "").trim()),
          currency: "USD",
          bank_reference: values.bank_reference?.trim() || undefined,
          notes: values.notes?.trim() || undefined,
        }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(result?.error || "创建失败")
      }
      const id =
        result?.data?.payment_id ??
        result?.data?.id ??
        result?.payment_id
      if (id != null) {
        toast.success("收款已保存")
        onCreated(String(id))
      } else {
        toast.error("创建成功但未返回收款 ID")
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "创建失败")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label>客户 *</Label>
        <FuzzySearchSelect
          value={form.watch("customer_id") ?? null}
          onChange={(v) => form.setValue("customer_id", v ? String(v) : "")}
          placeholder="搜索客户"
          loadOptions={loadCustomerOptions}
        />
        {form.formState.errors.customer_id && (
          <p className="text-sm text-destructive">
            {form.formState.errors.customer_id.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="payment_date">收款日期 *</Label>
        <Input id="payment_date" type="date" {...form.register("payment_date")} />
        {form.formState.errors.payment_date && (
          <p className="text-sm text-destructive">
            {form.formState.errors.payment_date.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">金额（USD）*</Label>
        <Input
          id="amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          {...form.register("amount")}
        />
        {form.formState.errors.amount && (
          <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="bank_reference">银行参考</Label>
        <Input id="bank_reference" placeholder="选填" {...form.register("bank_reference")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">备注</Label>
        <Textarea id="notes" placeholder="选填" rows={3} {...form.register("notes")} />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          取消
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              保存中
            </>
          ) : (
            "保存"
          )}
        </Button>
      </div>
    </form>
  )
}
