"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { EntityTable } from "@/components/crud/entity-table"
import { outboundShipmentConfig } from "@/lib/crud/configs/outbound-shipments"
import type { ClickableColumnConfig } from "@/lib/table/config"

export function OutboundShipmentTable() {
  const router = useRouter()

  // 可点击列配置：预约号码列可点击（跳转到预约详情页）
  const customClickableColumns: ClickableColumnConfig<any>[] = React.useMemo(() => [
    {
      columnId: "reference_number",
      onClick: (row: any) => {
        // 跳转到预约详情页
        if (row.appointment_id) {
          router.push(`/dashboard/oms/appointments/${row.appointment_id}`)
        }
      },
      disabled: (row: any) => !row.reference_number,
      showIcon: false,
      bold: false,
    },
  ], [router])

  return (
    <EntityTable 
      config={outboundShipmentConfig}
      customClickableColumns={customClickableColumns}
      customActions={{
        onView: undefined, // 隐藏查看详情
        onAdd: undefined, // 隐藏新建
        onDelete: undefined, // 隐藏删除
      }}
    />
  )
}

