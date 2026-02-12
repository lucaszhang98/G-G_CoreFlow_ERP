"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { Loader2, ArrowLeft } from "lucide-react"
import Link from "next/link"

type OrderDetailRow = {
  id: string
  order_id: string | null
  order_number: string | null
  delivery_location_code: string | null
  estimated_pallets: number
  unbooked_pallets: number
  container_number: string | null
}

export function NewAppointmentFromDetailsClient({
  orderDetailIds,
}: {
  orderDetailIds: string[]
}) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)
  const [details, setDetails] = React.useState<OrderDetailRow[]>([])
  const [orderIdOptions, setOrderIdOptions] = React.useState<{ order_id: string; order_number: string }[]>([])
  const [selectedOrderId, setSelectedOrderId] = React.useState<string>("")
  const [locations, setLocations] = React.useState<{ location_id: string; location_code: string; name?: string }[]>([])
  const [form, setForm] = React.useState({
    location_id: "",
    delivery_method: "卡派",
    reference_number: "",
    appointment_type: "卡板",
    appointment_account: "GG",
    notes: "",
  })
  const [linePallets, setLinePallets] = React.useState<Record<string, number>>({})

  const linesForOrder = React.useMemo(() => {
    if (!selectedOrderId) return details
    return details.filter((d) => d.order_id === selectedOrderId)
  }, [details, selectedOrderId])

  React.useEffect(() => {
    if (orderDetailIds.length === 0) {
      setLoading(false)
      return
    }
    const ids = orderDetailIds.join(",")
    Promise.all([
      fetch(`/api/oms/order-details?ids=${encodeURIComponent(ids)}`).then((r) => r.json()),
      fetch("/api/locations?limit=500").then((r) => r.json()),
    ])
      .then(([detailsRes, locationsRes]) => {
        const list = detailsRes.data ?? detailsRes.items ?? []
        setDetails(list)
        const orders = list.reduce((acc: { order_id: string; order_number: string }[], row: OrderDetailRow) => {
          if (row.order_id && row.order_number) {
            if (!acc.some((o) => o.order_id === row.order_id)) {
              acc.push({ order_id: row.order_id, order_number: row.order_number })
            }
          }
          return acc
        }, [])
        setOrderIdOptions(orders)
        if (orders.length === 1) setSelectedOrderId(orders[0].order_id)
        else if (orders.length > 0 && !selectedOrderId) setSelectedOrderId(orders[0].order_id)
        const locList = locationsRes.data ?? locationsRes.items ?? []
        setLocations(locList)
        const initialPallets: Record<string, number> = {}
        list.forEach((row: OrderDetailRow) => {
          initialPallets[row.id] = row.estimated_pallets ?? 0
        })
        setLinePallets(initialPallets)
      })
      .catch((e) => {
        console.error(e)
        toast.error("加载订单明细失败")
      })
      .finally(() => setLoading(false))
  }, [orderDetailIds.join(",")])

  const handleSubmit = async () => {
    if (linesForOrder.length === 0) {
      toast.error("当前订单下没有可用的明细行")
      return
    }
    if (!form.location_id) {
      toast.error("请选择目的地（送仓地点）")
      return
    }
    if (!selectedOrderId) {
      toast.error("请选择订单")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/oms/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: selectedOrderId,
          location_id: form.location_id,
          delivery_method: form.delivery_method,
          reference_number: form.reference_number || null,
          appointment_type: form.appointment_type || null,
          appointment_account: form.appointment_account || null,
          notes: form.notes || null,
          status: "待处理",
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || err?.message || "创建预约失败")
      }
      const appointment = await res.json()
      const appointmentId = appointment.appointment_id ?? appointment.id
      for (const row of linesForOrder) {
        const pallets = linePallets[row.id] ?? row.estimated_pallets ?? 0
        const lineRes = await fetch("/api/oms/appointment-detail-lines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appointment_id: String(appointmentId),
            order_detail_id: row.id,
            estimated_pallets: pallets,
          }),
        })
        if (!lineRes.ok) {
          const err = await lineRes.json().catch(() => ({}))
          throw new Error(err?.error || `添加明细失败: ${row.id}`)
        }
      }
      toast.success("预约已创建")
      router.push(`/dashboard/oms/appointments/${appointmentId}`)
    } catch (e: any) {
      toast.error(e?.message || "创建失败")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (orderDetailIds.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          请从订单明细列表勾选需要预约的明细行，再点击批量操作中的「新建预约」。
        </p>
        <Button variant="outline" asChild>
          <Link href="/dashboard/oms/order-details">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回订单明细
          </Link>
        </Button>
      </div>
    )
  }

  if (details.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">未找到勾选的订单明细数据。</p>
        <Button variant="outline" asChild>
          <Link href="/dashboard/oms/order-details">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回订单明细
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/oms/order-details">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回订单明细
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>新建预约（第一步）</CardTitle>
          <p className="text-sm text-muted-foreground">
            已带入勾选的 {details.length} 条订单明细，请选择订单、目的地并确认各明细预计板数后提交。
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {orderIdOptions.length > 1 && (
            <div className="grid gap-2">
              <Label>选择订单</Label>
              <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="选择订单" />
                </SelectTrigger>
                <SelectContent>
                  {orderIdOptions.map((o) => (
                    <SelectItem key={o.order_id} value={o.order_id}>
                      {o.order_number} (ID: {o.order_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                勾选的明细来自多个订单，请选择本次预约对应的订单，仅该订单下的明细会加入预约。
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="location_id">目的地（送仓地点）*</Label>
              <Select
                value={form.location_id}
                onValueChange={(v) => setForm((f) => ({ ...f, location_id: v }))}
              >
                <SelectTrigger id="location_id">
                  <SelectValue placeholder="选择送仓地点" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.location_id} value={String(loc.location_id)}>
                      {loc.location_code} {loc.name ? `- ${loc.name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="delivery_method">派送方式</Label>
              <Select
                value={form.delivery_method}
                onValueChange={(v) => setForm((f) => ({ ...f, delivery_method: v }))}
              >
                <SelectTrigger id="delivery_method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["私仓", "自提", "直送", "卡派"].map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reference_number">预约号码</Label>
              <Input
                id="reference_number"
                value={form.reference_number}
                onChange={(e) => setForm((f) => ({ ...f, reference_number: e.target.value }))}
                placeholder="选填"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="appointment_type">预约类型</Label>
              <Select
                value={form.appointment_type}
                onValueChange={(v) => setForm((f) => ({ ...f, appointment_type: v }))}
              >
                <SelectTrigger id="appointment_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="地板">地板</SelectItem>
                  <SelectItem value="卡板">卡板</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="appointment_account">预约账号</Label>
              <Select
                value={form.appointment_account}
                onValueChange={(v) => setForm((f) => ({ ...f, appointment_account: v }))}
              >
                <SelectTrigger id="appointment_account">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["AA", "YTAQ", "AYIE", "KP", "OLPN", "DATONG", "GG", "WGUY", "other"].map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt === "other" ? "Other" : opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">备注</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="选填"
              rows={2}
            />
          </div>

          <div>
            <Label className="mb-2 block">预约明细（{linesForOrder.length} 条）</Label>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>柜号/订单号</TableHead>
                    <TableHead>仓点</TableHead>
                    <TableHead>预计板数</TableHead>
                    <TableHead>未约板数</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linesForOrder.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.container_number ?? row.order_number ?? "-"}</TableCell>
                      <TableCell>{row.delivery_location_code ?? "-"}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          className="w-24"
                          value={linePallets[row.id] ?? ""}
                          onChange={(e) => {
                            const v = e.target.value === "" ? 0 : parseInt(e.target.value, 10)
                            setLinePallets((prev) => ({ ...prev, [row.id]: isNaN(v) ? 0 : v }))
                          }}
                        />
                      </TableCell>
                      <TableCell>{row.unbooked_pallets ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              创建预约
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/oms/order-details">取消</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
