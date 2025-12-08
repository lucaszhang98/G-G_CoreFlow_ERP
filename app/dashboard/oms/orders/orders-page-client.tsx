"use client"

import * as React from "react"
import { EntityTable } from "@/components/crud/entity-table"
import { orderConfig } from "@/lib/crud/configs/orders"
import { CreateOrderDialog } from "./create-order-dialog"
import { FuzzySearchOption } from "@/components/ui/fuzzy-search-select"

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

  // 为客户字段提供模糊搜索选项加载函数
  const loadCustomerOptions = async (search: string): Promise<FuzzySearchOption[]> => {
    try {
      const params = new URLSearchParams()
      if (search) {
        params.append('search', search)
      }
      params.append('unlimited', 'true')
      const response = await fetch(`/api/customers?${params.toString()}`)
      if (!response.ok) {
        throw new Error('加载客户选项失败')
      }
      const data = await response.json()
      const customers = data.data || []
      return customers.map((customer: any) => ({
        value: String(customer.id),
        label: customer.name || customer.code || String(customer.id),
        description: customer.company_name || customer.code,
      }))
    } catch (error) {
      console.error('加载客户选项失败:', error)
      return []
    }
  }

  // 为用户字段提供模糊搜索选项加载函数
  const loadUserOptions = async (search: string): Promise<FuzzySearchOption[]> => {
    try {
      const params = new URLSearchParams()
      if (search) {
        params.append('search', search)
      }
      params.append('unlimited', 'true')
      const response = await fetch(`/api/users?${params.toString()}`)
      if (!response.ok) {
        throw new Error('加载用户选项失败')
      }
      const data = await response.json()
      const users = data.data || []
      return users.map((user: any) => ({
        value: String(user.id),
        label: user.full_name || user.username || String(user.id),
        description: user.email || user.username,
      }))
    } catch (error) {
      console.error('加载用户选项失败:', error)
      return []
    }
  }

  // 为关系字段提供模糊搜索选项加载函数
  const fieldFuzzyLoadOptions = {
    customer: loadCustomerOptions,
    user_id: loadUserOptions,
  }

  return (
    <>
      <EntityTable 
        key={refreshKey}
        config={orderConfig} 
        customActions={customActions}
        fieldFuzzyLoadOptions={fieldFuzzyLoadOptions}
      />
      <CreateOrderDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleCreateSuccess}
      />
    </>
  )
}

