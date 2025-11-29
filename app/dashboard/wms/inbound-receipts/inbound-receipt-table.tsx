"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { EntityTable } from "@/components/crud/entity-table"
import { inboundReceiptConfig } from "@/lib/crud/configs/inbound-receipts"
import type { ClickableColumnConfig } from "@/lib/table/config"

export function InboundReceiptTable() {
  const router = useRouter()

  // 可点击列配置：柜号列可点击跳转到入库管理详情
  const customClickableColumns: ClickableColumnConfig<any>[] = React.useMemo(() => [
    {
      columnId: "container_number",
      onClick: (row: any) => {
        // 跳转到入库管理详情页
        if (row.inbound_receipt_id) {
          router.push(`/dashboard/wms/inbound-receipts/${row.inbound_receipt_id}`)
        }
      },
      disabled: (row: any) => !row.inbound_receipt_id,
      showIcon: true,
      bold: true,
      getTitle: (row: any) =>
        row.inbound_receipt_id
          ? `点击查看入库管理详情 (ID: ${row.inbound_receipt_id})`
          : "无法查看详情：缺少入库管理ID",
    },
  ], [router])

  return (
    <EntityTable 
      config={inboundReceiptConfig}
      customClickableColumns={customClickableColumns}
    />
  )
}

