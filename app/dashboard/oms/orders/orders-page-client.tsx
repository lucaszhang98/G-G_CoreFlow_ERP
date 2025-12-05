"use client"

import * as React from "react"
import { EntityTable } from "@/components/crud/entity-table"
import { orderConfig } from "@/lib/crud/configs/orders"
import { CreateOrderDialog } from "./create-order-dialog"

export function OrdersPageClient() {
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)
  const [refreshKey, setRefreshKey] = React.useState(0)

  const handleCreateSuccess = () => {
    setRefreshKey(prev => prev + 1)
  }

  // 订单管理不允许删除（单个和批量都不允许）
  const customActions = {
    onDelete: undefined, // 禁用单个删除
    onAdd: () => setCreateDialogOpen(true), // 自定义创建操作
  }

  return (
    <>
      <EntityTable 
        key={refreshKey}
        config={orderConfig} 
        customActions={customActions} 
      />
      <CreateOrderDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleCreateSuccess}
      />
    </>
  )
}

