"use client"

import React from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
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
import { LocationSelect } from "@/components/ui/location-select"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

type RowData = {
  id: string
  order_id?: string | null
  order_number?: string | null
  delivery_location_code?: string | null
  estimated_pallets?: number
  unbooked_pallets?: number
  container_number?: string | null
}

export function NewAppointmentDialog({
  open,
  onOpenChange,
  selectedRows,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedRows: RowData[]
  onSuccess?: (appointmentId: string) => void
}) {
  const router = useRouter()
  const [initLoading, setInitLoading] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [form, setForm] = React.useState({
    origin_location_id: "",
    location_id: "",
    delivery_method: "卡派",
    reference_number: "",
    appointment_type: "卡板",
    appointment_account: "GG",
    confirmed_date: "",
    confirmed_hour: "00",
    rejected: false,
    po: "",
    notes: "",
  })
  const [linePallets, setLinePallets] = React.useState<Record<string, number>>({})

  // 所有勾选的明细行都放入同一个预约，多对一
  const linesForAppointment = selectedRows

  React.useEffect(() => {
    if (!open || selectedRows.length === 0) return
    const next: Record<string, number> = {}
    selectedRows.forEach((row) => {
      next[row.id] = row.estimated_pallets ?? 0
    })
    setLinePallets(next)
  }, [open])

  // 打开弹窗时：重置表单，PO 自动填为预约明细中的柜号（逗号分隔），并自动拉取起始地 GG
  React.useEffect(() => {
    if (!open) return
    const poFromContainerNumbers =
      selectedRows.length > 0
        ? [...new Set(selectedRows.map((r) => (r.container_number ?? r.order_number ?? "").toString().trim()).filter(Boolean))].join(",")
        : ""
    setForm({
      origin_location_id: "",
      location_id: "",
      delivery_method: "卡派",
      reference_number: "",
      appointment_type: "卡板",
      appointment_account: "GG",
      confirmed_date: "",
      confirmed_hour: "00",
      rejected: false,
      po: poFromContainerNumbers,
      notes: "",
    })
    setInitLoading(true)
    fetch("/api/locations/by-type?type=warehouse")
      .then((r) => r.json())
      .then((res) => {
        const list = res.data ?? []
        const gg = list.find(
          (loc: { location_code?: string }) =>
            (loc.location_code || "").toUpperCase() === "GG"
        )
        if (gg) {
          setForm((prev) => ({
            ...prev,
            origin_location_id: String(gg.location_id),
          }))
        }
      })
      .catch(() => toast.error("加载起始地失败"))
      .finally(() => setInitLoading(false))
  }, [open])

  const handleSubmit = async () => {
    if (linesForAppointment.length === 0) {
      toast.error("没有可用的明细行")
      return
    }
    if (!form.location_id) {
      toast.error("请选择目的地（送仓地点）")
      return
    }
    const confirmed_start =
      form.confirmed_date && form.confirmed_hour != null
        ? `${form.confirmed_date}T${form.confirmed_hour.padStart(2, "0")}:00`
        : null
    const firstOrderId = linesForAppointment[0]?.order_id != null ? String(linesForAppointment[0].order_id) : null
    setSubmitting(true)
    try {
      const res = await fetch("/api/oms/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: firstOrderId,
          origin_location_id: form.origin_location_id || null,
          location_id: form.location_id,
          delivery_method: form.delivery_method,
          reference_number: form.reference_number || null,
          appointment_type: form.appointment_type || null,
          appointment_account: form.appointment_account || null,
          confirmed_start,
          rejected: form.rejected,
          po: form.po || null,
          notes: form.notes || null,
          status: "待处理",
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || err?.message || "创建预约失败")
      }
      const appointment = await res.json()
      const appointmentId = String(appointment.appointment_id ?? appointment.id)
      for (const row of linesForAppointment) {
        const pallets = linePallets[row.id] ?? row.estimated_pallets ?? 0
        const lineRes = await fetch("/api/oms/appointment-detail-lines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appointment_id: appointmentId,
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
      onOpenChange(false)
      onSuccess?.(appointmentId)
      router.push(`/dashboard/oms/appointments/${appointmentId}`)
    } catch (e: any) {
      toast.error(e?.message || "创建失败")
    } finally {
      setSubmitting(false)
    }
  }

  const hasRows = selectedRows.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>新建预约</DialogTitle>
          <DialogDescription>
            {hasRows
              ? `已带入勾选的 ${selectedRows.length} 条订单明细，将创建同一个预约；请填写目的地并确认各明细预计板数后提交。`
              : "请先勾选需要预约的订单明细。"}
          </DialogDescription>
        </DialogHeader>

        {!hasRows ? (
          <div className="py-4 text-sm text-muted-foreground">
            在列表中勾选明细行后，再点击「新建预约」即可在此弹窗中创建预约。
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            {initLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>起始地</Label>
                    <LocationSelect
                      value={form.origin_location_id || null}
                      onChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          origin_location_id: v != null ? String(v) : "",
                        }))
                      }
                      placeholder="先选位置类型，再选具体位置（默认 GG）"
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">默认为 GG，可改为码头/亚马逊/仓库中任一位置</p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="dl-location_id">目的地（送仓地点）*</Label>
                    <LocationSelect
                      value={form.location_id || null}
                      onChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          location_id: v != null ? String(v) : "",
                        }))
                      }
                      placeholder="先选位置类型，再选具体位置"
                      className="w-full"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="dl-delivery_method">派送方式</Label>
                    <Select
                      value={form.delivery_method}
                      onValueChange={(v) => setForm((f) => ({ ...f, delivery_method: v }))}
                    >
                      <SelectTrigger id="dl-delivery_method">
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
                    <Label htmlFor="dl-reference_number">预约号码</Label>
                    <Input
                      id="dl-reference_number"
                      value={form.reference_number}
                      onChange={(e) => setForm((f) => ({ ...f, reference_number: e.target.value }))}
                      placeholder="选填"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="dl-appointment_type">预约类型</Label>
                    <Select
                      value={form.appointment_type}
                      onValueChange={(v) => setForm((f) => ({ ...f, appointment_type: v }))}
                    >
                      <SelectTrigger id="dl-appointment_type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="地板">地板</SelectItem>
                        <SelectItem value="卡板">卡板</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="dl-appointment_account">预约账号</Label>
                    <Select
                      value={form.appointment_account}
                      onValueChange={(v) => setForm((f) => ({ ...f, appointment_account: v }))}
                    >
                      <SelectTrigger id="dl-appointment_account">
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
                  <div className="grid gap-2">
                    <Label>送货时间（选填，时间精确到小时）</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={form.confirmed_date}
                        onChange={(e) => setForm((f) => ({ ...f, confirmed_date: e.target.value }))}
                        placeholder="日期"
                        className="flex-1"
                      />
                      <Select
                        value={form.confirmed_hour}
                        onValueChange={(v) => setForm((f) => ({ ...f, confirmed_hour: v }))}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue placeholder="时" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 24 }, (_, i) => {
                            const h = String(i).padStart(2, "0")
                            return (
                              <SelectItem key={h} value={h}>
                                {h}:00
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-2 flex items-end pb-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="dl-rejected"
                        checked={form.rejected}
                        onCheckedChange={(v) => setForm((f) => ({ ...f, rejected: v === true }))}
                      />
                      <Label htmlFor="dl-rejected" className="cursor-pointer font-normal">
                        拒收
                      </Label>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor="dl-po">PO</Label>
                    <Textarea
                      id="dl-po"
                      value={form.po}
                      onChange={(e) => setForm((f) => ({ ...f, po: e.target.value }))}
                      placeholder="选填"
                      rows={1}
                    />
                  </div>
                  <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor="dl-notes">备注</Label>
                    <Textarea
                      id="dl-notes"
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      placeholder="选填"
                      rows={2}
                    />
                  </div>
                </div>

                <div>
                  <Label className="mb-2 block">预约明细（{linesForAppointment.length} 条）</Label>
                  <div className="rounded-md border overflow-auto max-h-[220px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>柜号/订单号</TableHead>
                          <TableHead>仓点</TableHead>
                          <TableHead className="w-[100px]">预计板数</TableHead>
                          <TableHead>未约板数</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {linesForAppointment.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="whitespace-nowrap">
                              {row.container_number ?? row.order_number ?? "-"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {row.delivery_location_code ?? "-"}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                className="w-20 h-8"
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
              </>
            )}
          </div>
        )}

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={!hasRows || submitting || initLoading}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            创建预约
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
