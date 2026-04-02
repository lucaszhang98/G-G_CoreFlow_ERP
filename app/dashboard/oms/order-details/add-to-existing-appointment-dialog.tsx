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
import { Loader2, AlertTriangle } from "lucide-react"

type RowData = {
  id: string
  order_id?: string | null
  order_number?: string | null
  delivery_location_code?: string | null
  estimated_pallets?: number
  remaining_pallets?: number | null
  unbooked_pallets?: number
  container_number?: string | null
  planned_unload_at?: string | null
}

type AppointmentOption = {
  appointment_id: string
  reference_number: string | null
  confirmed_start: string | null
  destination_location?: string | null
  total_pallets?: number | null
  delivery_method?: string | null
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
  const [allAppointments, setAllAppointments] = React.useState<AppointmentOption[]>([])
  const [candidateAppointments, setCandidateAppointments] = React.useState<AppointmentOption[]>([])
  const [appointmentSearch, setAppointmentSearch] = React.useState("")
  const [selectedAppointmentId, setSelectedAppointmentId] = React.useState<string>("")
  const [linePallets, setLinePallets] = React.useState<Record<string, number>>({})
  const [submitting, setSubmitting] = React.useState(false)
  /** 仓点与预约目的地不一致时的确认弹窗 */
  const [mismatchDialogOpen, setMismatchDialogOpen] = React.useState(false)
  const [mismatchList, setMismatchList] = React.useState<{ container_number: string; detail_location: string; appointment_destination: string }[]>([])

  const MAX_ADD_LINES = 50
  const linesForAppointment = selectedRows

  /** 当前选中的预约信息（含目的地） */
  const selectedAppointment = React.useMemo(
    () => candidateAppointments.find((a) => a.appointment_id === selectedAppointmentId) || allAppointments.find((a) => a.appointment_id === selectedAppointmentId),
    [candidateAppointments, allAppointments, selectedAppointmentId]
  )

  /** 根据选中明细的仓点、预计拆柜日期和派送方式筛选匹配的预约 */
  React.useEffect(() => {
    if (!open || selectedRows.length === 0 || allAppointments.length === 0) {
      setCandidateAppointments([])
      return
    }

    // 收集所有选中明细的仓点代码
    const detailLocationCodes = selectedRows
      .map((row) => (row.delivery_location_code ?? "").trim())
      .filter(Boolean)
    
    // 收集所有选中明细的预计拆柜日期（取最早的日期作为基准）
    const plannedUnloadDates = selectedRows
      .map((row) => row.planned_unload_at)
      .filter(Boolean)
      .map((dateStr) => new Date(dateStr!))
      .filter((date) => !isNaN(date.getTime()))
    
    const earliestPlannedUnloadDate = plannedUnloadDates.length > 0
      ? new Date(Math.min(...plannedUnloadDates.map(d => d.getTime())))
      : null

    if (detailLocationCodes.length === 0) {
      setCandidateAppointments(allAppointments)
      return
    }

    // 筛选出符合条件的预约：
    // 1. 目的地与明细仓点匹配
    // 2. 送货时间晚于预计拆柜日期（如果有预计拆柜日期）
    // 3. 派送方式不能是"直送"
    const candidates = allAppointments.filter((appt) => {
      const appointmentDestination = (appt.destination_location ?? "").trim()
      // 如果预约目的地为空，不匹配
      if (!appointmentDestination) return false
      // 如果预约目的地与任意一个明细的仓点不匹配，不显示
      if (!detailLocationCodes.includes(appointmentDestination)) return false
      
      // 派送方式不能是"直送"
      if (appt.delivery_method === "直送") return false
      
      // 如果有预计拆柜日期，预约的送货时间必须晚于预计拆柜日期
      if (earliestPlannedUnloadDate && appt.confirmed_start) {
        const appointmentDate = new Date(appt.confirmed_start)
        // 只比较日期部分（忽略时间）
        appointmentDate.setHours(0, 0, 0, 0)
        const plannedDate = new Date(earliestPlannedUnloadDate)
        plannedDate.setHours(0, 0, 0, 0)
        // 预约日期必须晚于或等于预计拆柜日期（>=）
        if (appointmentDate < plannedDate) return false
      }
      
      return true
    })

    setCandidateAppointments(candidates.length > 0 ? candidates : allAppointments)
    
    // 如果当前选中的预约不在候选列表中，自动选择第一个候选预约
    if (candidates.length > 0) {
      const currentSelectedExists = candidates.some((a) => a.appointment_id === selectedAppointmentId)
      if (!currentSelectedExists) {
        setSelectedAppointmentId(candidates[0].appointment_id)
      }
    }
  }, [open, selectedRows, allAppointments, selectedAppointmentId])

  React.useEffect(() => {
    if (!open || selectedRows.length === 0) return
    const next: Record<string, number> = {}
    selectedRows.forEach((row) => {
      // 统一用未约板数作为默认；缺省时回退订单明细预计板数
      next[row.id] = row.unbooked_pallets ?? row.estimated_pallets ?? 0
    })
    setLinePallets(next)
  }, [open, selectedRows])

  // 加载预约列表（打开弹窗或搜索变化时）
  React.useEffect(() => {
    if (!open) return
    setLoadingAppointments(true)
    const params = new URLSearchParams({ limit: "100", page: "1" })
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
            total_pallets: a.total_pallets ?? null,
            delivery_method: a.delivery_method ?? null,
          }))
        setAllAppointments(options)
      })
      .catch(() => toast.error("加载预约列表失败"))
      .finally(() => setLoadingAppointments(false))
  }, [open, appointmentSearch])

  /** 执行加入预约的 API 请求（校验通过后或用户确认不一致仍加入时调用） */
  const doSubmit = React.useCallback(async () => {
    const validRows = linesForAppointment.filter((row) => row.id != null && String(row.id).trim() !== "")
    if (validRows.length === 0) return
    setSubmitting(true)
    try {
      const lines = validRows.map((row) => ({
        order_detail_id: String(row.id),
        estimated_pallets: linePallets[row.id] ?? row.unbooked_pallets ?? row.estimated_pallets ?? 0,
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
      setMismatchDialogOpen(false)
      onOpenChange(false)
      onSuccess?.(selectedAppointmentId)
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message || "加入失败")
    } finally {
      setSubmitting(false)
    }
  }, [linesForAppointment, linePallets, selectedAppointmentId, onOpenChange, onSuccess, router])

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
    const validRows = linesForAppointment.filter((row) => row.id != null && String(row.id).trim() !== "")
    if (validRows.length === 0) {
      toast.error("勾选的明细缺少有效 ID，请刷新页面后重新勾选")
      return
    }

    const appointmentDestination = (selectedAppointment?.destination_location ?? "").trim()
    const mismatches = validRows.filter((row) => {
      const detailLocation = (row.delivery_location_code ?? "").trim()
      return detailLocation !== appointmentDestination
    })
    if (mismatches.length > 0) {
      setMismatchList(
        mismatches.map((row) => ({
          container_number: row.container_number ?? row.order_number ?? String(row.id),
          detail_location: (row.delivery_location_code ?? "").trim() || "—",
          appointment_destination: appointmentDestination || "—",
        }))
      )
      setMismatchDialogOpen(true)
      return
    }

    await doSubmit()
  }

  const handleConfirmMismatchSubmit = () => {
    doSubmit()
  }

  const hasRows = selectedRows.length > 0

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>加入已存在的预约</DialogTitle>
          <DialogDescription>
            {hasRows
              ? `已带入勾选的 ${selectedRows.length} 条订单明细（最多 ${MAX_ADD_LINES} 条），请选择目标预约并确认未约板数。提交后全部成功或全部不生效。`
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
              <div className="flex items-center justify-between">
                <Label>可选预约（根据选中明细的仓点自动筛选）</Label>
                <Input
                  placeholder="搜索预约号码（可选）"
                  value={appointmentSearch}
                  onChange={(e) => setAppointmentSearch(e.target.value)}
                  className="max-w-[200px]"
                />
              </div>
              {loadingAppointments ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">加载预约列表中…</span>
                </div>
              ) : candidateAppointments.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  暂无匹配的预约
                </div>
              ) : (
                <div className="rounded-md border max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">选择</TableHead>
                        <TableHead>预约号码</TableHead>
                        <TableHead>送货时间</TableHead>
                        <TableHead>目的地</TableHead>
                        <TableHead>板数</TableHead>
                        <TableHead>派送方式</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {candidateAppointments.map((a) => (
                        <TableRow
                          key={a.appointment_id}
                          className={`cursor-pointer ${
                            selectedAppointmentId === a.appointment_id
                              ? "bg-muted"
                              : "hover:bg-muted/50"
                          }`}
                          onClick={() => setSelectedAppointmentId(a.appointment_id)}
                        >
                          <TableCell>
                            <input
                              type="radio"
                              checked={selectedAppointmentId === a.appointment_id}
                              onChange={() => setSelectedAppointmentId(a.appointment_id)}
                              className="cursor-pointer"
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {a.reference_number || a.appointment_id}
                          </TableCell>
                          <TableCell>
                            {a.confirmed_start
                              ? new Date(a.confirmed_start).toLocaleDateString("zh-CN", {
                                  month: "2-digit",
                                  day: "2-digit",
                                })
                              : "-"}
                          </TableCell>
                          <TableCell>{a.destination_location || "-"}</TableCell>
                          <TableCell>
                            {a.total_pallets !== null && a.total_pallets !== undefined
                              ? Math.round(a.total_pallets).toLocaleString()
                              : "-"}
                          </TableCell>
                          <TableCell>{a.delivery_method || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* 明细与未约板数（提交为预约明细的 estimated_pallets） */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>柜号/订单号</TableHead>
                    <TableHead>未约板数</TableHead>
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

    {/* 仓点与预约目的地不一致时的确认弹窗 */}
    <Dialog open={mismatchDialogOpen} onOpenChange={setMismatchDialogOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            仓点与预约目的地不一致
          </DialogTitle>
          <DialogDescription>
            以下明细的仓点与目标预约目的地不一致，请核对后再决定是否仍要加入。
          </DialogDescription>
          <div className="space-y-2">
              <div className="rounded-md border bg-muted/30 max-h-[240px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="py-2 text-xs">柜号/订单号</TableHead>
                      <TableHead className="py-2 text-xs">明细仓点</TableHead>
                      <TableHead className="py-2 text-xs">预约目的地</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mismatchList.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="py-1.5 text-sm">{item.container_number}</TableCell>
                        <TableCell className="py-1.5 text-sm">{item.detail_location}</TableCell>
                        <TableCell className="py-1.5 text-sm">{item.appointment_destination}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
          </div>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setMismatchDialogOpen(false)}>
            取消
          </Button>
          <Button
            onClick={handleConfirmMismatchSubmit}
            disabled={submitting}
            className="bg-amber-600 hover:bg-amber-700 focus:ring-amber-500"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                提交中…
              </>
            ) : (
              "仍要加入"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  )
}
