"use client"

import React from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

type RowData = {
  id: string
  order_id?: string | null
  order_number?: string | null
  delivery_location_code?: string | null
  estimated_pallets?: number
  remaining_pallets?: number | null
  unbooked_pallets?: number
  container_number?: string | null
}

type AppointmentOption = {
  appointment_id: string
  reference_number: string | null
  confirmed_start: string | null
  destination_location?: string | null
}

export function AddToExistingAppointmentDialog({
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
  const [loadingAppointments, setLoadingAppointments] = React.useState(false)
  const [appointments, setAppointments] = React.useState<AppointmentOption[]>([])
  const [appointmentSearch, setAppointmentSearch] = React.useState("")
  const [selectedAppointmentId, setSelectedAppointmentId] = React.useState<string>("")
  const [linePallets, setLinePallets] = React.useState<Record<string, number>>({})
  const [submitting, setSubmitting] = React.useState(false)

  const MAX_ADD_LINES = 50
  const linesForAppointment = selectedRows

  React.useEffect(() => {
    if (!open || selectedRows.length === 0) return
    const next: Record<string, number> = {}
    selectedRows.forEach((row) => {
      // 默认使用剩余板数（未约板数），其次预计板数
      next[row.id] = row.remaining_pallets ?? row.unbooked_pallets ?? row.estimated_pallets ?? 0
    })
    setLinePallets(next)
  }, [open, selectedRows])

  // 加载预约列表（打开弹窗或搜索变化时）
  React.useEffect(() => {
    if (!open) return
    setLoadingAppointments(true)
    const params = new URLSearchParams({ limit: "50", page: "1" })
    if (appointmentSearch.trim()) params.set("search", appointmentSearch.trim())
    fetch(`/api/oms/appointments?${params}`)
      .then((r) => r.json())
      .then((res) => {
        const list = res.data ?? []
        const options = list.map((a: any) => ({
            appointment_id: String(a.appointment_id ?? a.id ?? ""),
            reference_number: a.reference_number ?? null,
            confirmed_start: a.confirmed_start ?? null,
            destination_location: a.destination_location ?? null,
          }))
        setAppointments(options)
        if (options.length > 0) {
          setSelectedAppointmentId((prev) => {
            const exists = options.some((o: AppointmentOption) => o.appointment_id === prev)
            return exists ? prev : options[0].appointment_id
          })
        }
      })
      .catch(() => toast.error("加载预约列表失败"))
      .finally(() => setLoadingAppointments(false))
  }, [open, appointmentSearch])

  const handleSubmit = async () => {
    if (linesForAppointment.length === 0) {
      toast.error("没有可用的明细行")
      return
    }
    if (!selectedAppointmentId) {
      toast.error("请选择要加入的预约")
      return
    }
    if (linesForAppointment.length > MAX_ADD_LINES) {
      toast.error(`最多一次性加入 ${MAX_ADD_LINES} 条，当前勾选 ${linesForAppointment.length} 条，请减少勾选后再试`)
      return
    }
    setSubmitting(true)
    try {
      const lines = linesForAppointment.map((row) => ({
        order_detail_id: row.id,
        estimated_pallets: linePallets[row.id] ?? row.remaining_pallets ?? row.unbooked_pallets ?? row.estimated_pallets ?? 0,
      }))
      const res = await fetch("/api/oms/appointment-detail-lines/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_id: selectedAppointmentId,
          lines,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || "加入预约失败")
      }
      toast.success(`已加入预约，共 ${data?.data?.created ?? lines.length} 条明细`)
      onOpenChange(false)
      onSuccess?.(selectedAppointmentId)
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message || "加入失败")
    } finally {
      setSubmitting(false)
    }
  }

  const hasRows = selectedRows.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>加入已存在的预约</DialogTitle>
          <DialogDescription>
            {hasRows
              ? `已带入勾选的 ${selectedRows.length} 条订单明细（最多 ${MAX_ADD_LINES} 条），请选择目标预约并确认预计板数。提交后全部成功或全部不生效。`
              : "请先勾选需要加入预约的订单明细。"}
          </DialogDescription>
        </DialogHeader>

        {!hasRows ? (
          <div className="py-4 text-sm text-muted-foreground">
            在列表中勾选明细行后，再点击「加入已存在的预约」即可在此选择预约并加入。
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            {/* 预约选择 */}
            <div className="grid gap-2">
              <Label>选择预约</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="搜索预约号码（可选）"
                  value={appointmentSearch}
                  onChange={(e) => setAppointmentSearch(e.target.value)}
                  className="max-w-[200px]"
                />
                <Select
                  value={selectedAppointmentId}
                  onValueChange={setSelectedAppointmentId}
                  disabled={loadingAppointments}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={loadingAppointments ? "加载中…" : "请选择预约"} />
                  </SelectTrigger>
                  <SelectContent>
                    {appointments.map((a) => (
                      <SelectItem key={a.appointment_id} value={a.appointment_id}>
                        {a.reference_number || a.appointment_id} {a.confirmed_start ? ` (${a.confirmed_start})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 明细与预计板数 */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>柜号/订单号</TableHead>
                    <TableHead>预计板数</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linesForAppointment.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.container_number ?? row.order_number ?? row.id}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={linePallets[row.id] ?? ""}
                          onChange={(e) =>
                            setLinePallets((prev) => ({
                              ...prev,
                              [row.id]: Math.max(0, parseInt(e.target.value, 10) || 0),
                            }))
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            disabled={!hasRows || !selectedAppointmentId || submitting}
            onClick={handleSubmit}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                提交中…
              </>
            ) : (
              "确认加入"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
