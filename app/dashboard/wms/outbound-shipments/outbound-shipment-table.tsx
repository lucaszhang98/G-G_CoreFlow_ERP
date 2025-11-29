"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { EntityTable } from "@/components/crud/entity-table"
import { outboundShipmentConfig } from "@/lib/crud/configs/outbound-shipments"
import type { ClickableColumnConfig } from "@/lib/table/config"

export function OutboundShipmentTable() {
  const router = useRouter()

  // 可点击列配置：预约号码列可点击（后续可添加链接）
  const customClickableColumns: ClickableColumnConfig<any>[] = React.useMemo(() => [
    {
      columnId: "shipment_number",
      onClick: (row: any) => {
        // 后续可以跳转到预约详情页
        if (row.outbound_shipment_id) {
          // router.push(`/dashboard/wms/outbound-shipments/${row.outbound_shipment_id}`)
        }
      },
      disabled: (row: any) => !row.shipment_number,
      showIcon: false,
      bold: false,
    },
  ], [router])

  return (
    <EntityTable 
      config={outboundShipmentConfig}
      customClickableColumns={customClickableColumns}
    />
  )
}

