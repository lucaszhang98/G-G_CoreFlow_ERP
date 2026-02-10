"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FuzzySearchSelect, type FuzzySearchOption } from "@/components/ui/fuzzy-search-select"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

const schema = z.object({
  customer_id: z.string().min(1, "请选择客户"),
  order_id: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["draft", "issued", "void"]).default("draft"),
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

async function loadOrderOptions(search: string): Promise<FuzzySearchOption[]> {
  const params = new URLSearchParams()
  params.set("unlimited", "true")
  if (search) params.set("search", search)
  const res = await fetch(`/api/orders?${params.toString()}`)
  if (!res.ok) throw new Error("加载订单失败")
  const data = await res.json()
  const list = data.data ?? data.items ?? []
  return list.map((o: { order_id: number; order_number?: string }) => ({
    value: o.order_id,
    label: o.order_number || String(o.order_id),
  }))
}

export function NewDirectDeliveryBillForm() {
  const router = useRouter()
  const [submitting, setSubmitting] = React.useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { status: "draft" },
  })

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        invoice_type: "direct_delivery",
        customer_id: Number(values.customer_id),
        notes: values.notes || undefined,
        status: values.status,
      }
      if (values.order_id) body.order_id = Number(values.order_id)
      const res = await fetch("/api/finance/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || "创建失败")
      }
      const result = await res.json()
      const id = result?.data?.invoice_id ?? result?.invoice_id
      if (id != null) {
        toast.success("直送账单已创建，请添加明细")
        router.push(`/dashboard/finance/bills/direct-delivery/${id}`)
      } else {
        toast.error("创建成功但未返回发票 ID")
      }
    } catch (e: any) {
      toast.error(e?.message || "创建失败")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>主行信息</CardTitle>
        <p className="text-sm text-muted-foreground">
          发票号与开票日期将自动生成，保存后可添加明细。
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
            <Label>订单号（选填）</Label>
            <FuzzySearchSelect
              value={form.watch("order_id") ?? null}
              onChange={(v) => form.setValue("order_id", v ? String(v) : undefined)}
              placeholder="搜索订单号"
              loadOptions={loadOrderOptions}
            />
          </div>
          <div className="space-y-2">
            <Label>状态</Label>
            <Select
              value={form.watch("status")}
              onValueChange={(v) => form.setValue("status", v as FormValues["status"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="issued">已开票</SelectItem>
                <SelectItem value="void">作废</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>备注</Label>
            <Textarea
              {...form.register("notes")}
              placeholder="选填"
              rows={3}
              className="resize-none"
            />
          </div>
          <div className="flex gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存并添加明细
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/finance/bills/direct-delivery")}
            >
              取消
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
