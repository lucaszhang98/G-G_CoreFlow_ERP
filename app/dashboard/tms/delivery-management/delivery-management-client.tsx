"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { EntityTable } from "@/components/crud/entity-table"
import { deliveryManagementConfig } from "@/lib/crud/configs/delivery-management"
import { IncludeArchivedOrdersToggle } from "@/components/order-visibility/include-archived-toggle"
import { DeliverySummaryDialog } from "@/components/delivery-management/delivery-summary-dialog"
import { Button } from "@/components/ui/button"
import { CalendarRange, FileText } from "lucide-react"
import { toast } from "sonner"

const EMPTY_EXTRA_LIST_PARAMS: Record<string, string> = {}

export function DeliveryManagementClient() {
  const router = useRouter()
  const pathname = usePathname()

  // 默认包含留档：直送预约常挂在已归档订单上，排除留档时送仓列表会远少于预约管理
  const [includeArchived, setIncludeArchived] = React.useState(true)
  const [nearDeliveryActive, setNearDeliveryActive] = React.useState(false)
  const [selectedRows, setSelectedRows] = React.useState<any[]>([])
  const [orderedSelectedRows, setOrderedSelectedRows] = React.useState<any[]>([])
  const selectedIdsRef = React.useRef<Set<string>>(new Set())
  const [summaryDialogOpen, setSummaryDialogOpen] = React.useState(false)

  React.useLayoutEffect(() => {
    if (typeof window === "undefined") return
    const q = new URLSearchParams(window.location.search)
    setNearDeliveryActive(q.get("near_delivery") === "1")
  }, [])

  const extraListParams = React.useMemo((): Record<string, string> => {
    const p: Record<string, string> = {}
    if (includeArchived) p.includeArchived = "true"
    if (nearDeliveryActive) p.near_delivery = "1"
    return p
  }, [includeArchived, nearDeliveryActive])

  const toggleNearDelivery = React.useCallback(() => {
    const next = !nearDeliveryActive
    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : ""
    )
    if (next) {
      params.set("near_delivery", "1")
      params.set("page", "1")
    } else {
      params.delete("near_delivery")
    }
    setNearDeliveryActive(next)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [nearDeliveryActive, pathname, router])

  const customFilterContent = React.useCallback(
    () => (
      <Button
        type="button"
        variant={nearDeliveryActive ? "default" : "outline"}
        size="sm"
        className="h-9 shrink-0 gap-1.5"
        onClick={toggleNearDelivery}
        title="送货日期（确认/请求时间）落在：昨天 0 点～后天 24 点（UTC 日历，共 4 天含今天）"
      >
        <CalendarRange className="h-4 w-4" />
        近窗送货
      </Button>
    ),
    [nearDeliveryActive, toggleNearDelivery]
  )

  const customToolbarButtons = React.useMemo(
    () => (
      <IncludeArchivedOrdersToggle
        checked={includeArchived}
        onCheckedChange={setIncludeArchived}
        id="delivery-management-include-archived"
      />
    ),
    [includeArchived]
  )

  React.useEffect(() => {
    const idField = deliveryManagementConfig.idField || "delivery_id"
    const currentSelectedIds = new Set(selectedRows.map((row) => String(row[idField])))
    const newlySelected = selectedRows.filter((row) => {
      const id = String(row[idField])
      return !selectedIdsRef.current.has(id)
    })
    const deselectedIds = new Set<string>()
    selectedIdsRef.current.forEach((id) => {
      if (!currentSelectedIds.has(id)) deselectedIds.add(id)
    })
    setOrderedSelectedRows((prev) => {
      let updated = prev.filter((row) => !deselectedIds.has(String(row[idField])))
      updated = [...updated, ...newlySelected]
      return updated
    })
    selectedIdsRef.current = currentSelectedIds
  }, [selectedRows])

  const customBatchActions = React.useMemo(
    () => (
      <Button
        variant="outline"
        size="sm"
        className="min-w-[100px] h-9"
        onClick={() => {
          if (orderedSelectedRows.length === 0) {
            toast.error("请先选择要汇总的记录")
            return
          }
          setSummaryDialogOpen(true)
        }}
      >
        <FileText className="mr-2 h-4 w-4" />
        汇总信息
      </Button>
    ),
    [orderedSelectedRows.length]
  )

  return (
    <>
      <EntityTable
        config={deliveryManagementConfig}
        extraListParams={extraListParams}
        customToolbarButtons={customToolbarButtons}
        customFilterContent={customFilterContent}
        customBatchActions={customBatchActions}
        onRowSelectionChange={setSelectedRows}
      />
      <DeliverySummaryDialog
        open={summaryDialogOpen}
        onOpenChange={setSummaryDialogOpen}
        selectedRecords={orderedSelectedRows}
      />
    </>
  )
}
