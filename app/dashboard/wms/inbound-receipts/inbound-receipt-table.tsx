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

  // 加载用户选项（用于入库人员字段）
  const loadUsersOptions = React.useCallback(async () => {
    try {
      const response = await fetch('/api/users?limit=1000&sort=full_name&order=asc')
      if (!response.ok) {
        throw new Error('获取用户列表失败')
      }
      const result = await response.json()
      const users = result.data || []
      return users.map((user: any) => ({
        label: user.full_name || user.username || `用户 ${user.id}`,
        value: String(user.id),
      }))
    } catch (error) {
      console.error('加载用户选项失败:', error)
      return []
    }
  }, [])

  // 字段选项加载函数（用于批量编辑和行内编辑中的关系字段）
  const fieldLoadOptions = React.useMemo(() => ({
    received_by: loadUsersOptions,
  }), [loadUsersOptions])

  return (
    <EntityTable 
      config={inboundReceiptConfig}
      customClickableColumns={customClickableColumns}
      fieldLoadOptions={fieldLoadOptions}
    />
  )
}

