"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { EntityTable } from "@/components/crud/entity-table"
import { outboundShipmentConfig } from "@/lib/crud/configs/outbound-shipments"
import type { ClickableColumnConfig } from "@/lib/table/config"

export function OutboundShipmentTable() {
  const router = useRouter()

  // 可点击列配置：预约号码列可点击（跳转到预约管理页面并搜索该预约号码）
  const customClickableColumns: ClickableColumnConfig<any>[] = React.useMemo(() => [
    {
      columnId: "reference_number",
      onClick: (row: any) => {
        // 跳转到预约管理页面并搜索该预约号码
        if (row.reference_number) {
          const url = `/dashboard/oms/appointments?search=${encodeURIComponent(row.reference_number)}`
          console.log('[OutboundShipmentTable] 跳转到:', url)
          // 使用 window.location.href 确保完整跳转并刷新页面
          window.location.href = url
        }
      },
      disabled: (row: any) => !row.reference_number,
      showIcon: true, // 显示外部链接图标
      bold: true, // 加粗显示
      getTitle: (row: any) => `在预约管理中搜索: ${row.reference_number || ''}`,
    },
  ], [router])

  return (
    <EntityTable 
      config={outboundShipmentConfig}
      customClickableColumns={customClickableColumns}
      customActions={{
        onView: null, // 隐藏查看详情（null 表示隐藏）
        onAdd: undefined, // 隐藏新建
        onDelete: undefined, // 隐藏删除
      }}
    />
  )
}

