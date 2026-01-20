"use client"

import * as React from "react"
import { EntityTable } from "@/components/crud/entity-table"
import { deliveryManagementConfig } from "@/lib/crud/configs/delivery-management"
import { FuzzySearchOption } from "@/components/ui/fuzzy-search-select"

export function DeliveryManagementClient() {
  // 加载司机选项（用于送仓司机字段）
  const loadDriverOptions = React.useCallback(async (search: string): Promise<FuzzySearchOption[]> => {
    try {
      const params = new URLSearchParams({
        unlimited: 'true',
        sort: 'driver_code',
        order: 'asc',
      })
      if (search && search.trim()) {
        params.append('search', search.trim())
        params.append('unlimited', 'true')
      }
      
      const response = await fetch(`/api/drivers?${params.toString()}`)
      if (!response.ok) {
        throw new Error('获取司机列表失败')
      }
      const result = await response.json()
      const drivers = result.data || []
      
      return drivers.map((driver: any) => ({
        label: driver.driver_code || '',
        value: String(driver.driver_id || ''),
      }))
    } catch (error) {
      console.error('加载司机选项失败:', error)
      return []
    }
  }, [])

  return (
    <EntityTable 
      config={deliveryManagementConfig}
      fieldFuzzyLoadOptions={{
        driver_name: loadDriverOptions,
        driver_id: loadDriverOptions, // 也支持 driver_id 作为 key
      }}
    />
  )
}

