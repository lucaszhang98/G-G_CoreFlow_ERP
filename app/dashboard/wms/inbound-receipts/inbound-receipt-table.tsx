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

  // 加载拆柜人员选项（只显示入库工人角色）
  const loadUnloadedByOptions = React.useCallback(async () => {
    try {
      // 尝试使用 filter_role 参数，如果不支持则在前端过滤
      const response = await fetch('/api/users?limit=1000&sort=name&order=asc&filter_role=wms_inbound_worker')
      if (!response.ok) {
        throw new Error('获取拆柜人员列表失败')
      }
      const result = await response.json()
      const users = result.data || []
      // 在前端再次过滤，确保只返回入库工人（以防 API 不支持 filter_role）
      const filteredUsers = users.filter((user: any) => 
        user.role === 'wms_inbound_worker' && user.status === 'active'
      )
      return filteredUsers.map((user: any) => ({
        label: user.name || user.username || `用户 ${user.id}`,
        value: String(user.id),
      }))
    } catch (error) {
      console.error('加载拆柜人员选项失败:', error)
      return []
    }
  }, [])

  // 加载入库人员选项（显示仓库主管和入库工人）
  const loadReceivedByOptions = React.useCallback(async () => {
    try {
      // 获取角色为 wms_supervisor（仓库主管）和 wms_inbound_worker（入库工人）的用户
      // 由于 API 可能不支持多角色过滤，我们先获取所有用户，然后在前端过滤
      const response = await fetch('/api/users?limit=1000&sort=name&order=asc')
      if (!response.ok) {
        throw new Error('获取入库人员列表失败')
      }
      const result = await response.json()
      const users = result.data || []
      // 过滤出仓库主管和入库工人，且状态为活跃
      const filteredUsers = users.filter((user: any) => 
        (user.role === 'wms_supervisor' || user.role === 'wms_inbound_worker') && user.status === 'active'
      )
      return filteredUsers.map((user: any) => ({
        label: user.name || user.username || `用户 ${user.id}`,
        value: String(user.id),
      }))
    } catch (error) {
      console.error('加载入库人员选项失败:', error)
      return []
    }
  }, [])

  // 字段选项加载函数（用于批量编辑和行内编辑中的关系字段）
  const fieldLoadOptions = React.useMemo(() => ({
    unloaded_by: loadUnloadedByOptions, // 拆柜人员：只显示入库工人
    received_by: loadReceivedByOptions, // 入库人员：显示仓库主管和入库工人
  }), [loadUnloadedByOptions, loadReceivedByOptions])

  return (
    <EntityTable 
      config={inboundReceiptConfig}
      customClickableColumns={customClickableColumns}
      fieldLoadOptions={fieldLoadOptions}
    />
  )
}

