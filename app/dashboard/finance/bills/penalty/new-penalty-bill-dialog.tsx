"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}

export function NewPenaltyBillDialog({ open, onOpenChange, onCreated }: Props) {
  const router = useRouter()
  const [containerNumber, setContainerNumber] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setContainerNumber("")
      setSubmitting(false)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = containerNumber.trim()
    if (!trimmed) {
      toast.error("请输入柜号")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/finance/invoices/create-penalty-from-container", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ container_number: trimmed }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = typeof payload.error === "string" ? payload.error : "创建失败"
        toast.error(msg)
        return
      }
      const id = payload.data?.invoice_id
      if (id == null) {
        toast.error("创建成功但未返回账单 ID")
        return
      }
      toast.success("负数账单已创建（已含返利明细）")
      onOpenChange(false)
      onCreated?.()
      router.push(`/dashboard/finance/bills/penalty/${String(id)}`)
    } catch {
      toast.error("网络错误，请重试")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>新建负数账单</DialogTitle>
            <DialogDescription>
              只需输入柜号（订单号）。系统将带出客户与订单，并按费用表匹配 Others/other 生成一条返利明细（备注「返利」，默认金额 -100）；若费用表无匹配行将提示先维护费用。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="penalty-bill-container">柜号</Label>
              <Input
                id="penalty-bill-container"
                value={containerNumber}
                onChange={(ev) => setContainerNumber(ev.target.value)}
                placeholder="与订单柜号一致"
                autoComplete="off"
                disabled={submitting}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  创建中
                </>
              ) : (
                "创建"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
