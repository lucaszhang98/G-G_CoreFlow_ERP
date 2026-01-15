"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { EntityTable } from "@/components/crud/entity-table"
import { outboundShipmentConfig } from "@/lib/crud/configs/outbound-shipments"
import type { ClickableColumnConfig } from "@/lib/table/config"

export function OutboundShipmentTable() {
  const router = useRouter()

  // 获取出库组部门ID（缓存，只获取一次）
  const departmentIdCacheRef = React.useRef<string | null | undefined>(undefined)
  const getOutboundGroupDepartmentId = React.useCallback(async (): Promise<string | null> => {
    // 如果已经缓存，直接返回
    if (departmentIdCacheRef.current !== undefined) {
      return departmentIdCacheRef.current
    }
    
    try {
      // 先尝试通过名称查找
      const response = await fetch('/api/departments?search=出库组&limit=100')
      if (!response.ok) {
        departmentIdCacheRef.current = null
        return null
      }
      const result = await response.json()
      const departments = result.data || []
      const outboundGroup = departments.find((dept: any) => 
        dept.name === '出库组' || dept.code === '出库组' || dept.name?.includes('出库组')
      )
      const departmentId = outboundGroup ? String(outboundGroup.id) : null
      departmentIdCacheRef.current = departmentId
      return departmentId
    } catch (error) {
      console.error('获取出库组部门ID失败:', error)
      departmentIdCacheRef.current = null
      return null
    }
  }, [])

  // 装车人选项缓存（按搜索词缓存）
  const loadedByOptionsCacheRef = React.useRef<Map<string, Array<{ label: string; value: string }>>>(new Map())
  
  // 加载装车人选项（部门为出库组且角色为叉车工的用户）
  const loadLoadedByOptions = React.useCallback(async (search: string = '') => {
    const cacheKey = search.trim()
    
    // 检查缓存
    if (loadedByOptionsCacheRef.current.has(cacheKey)) {
      return loadedByOptionsCacheRef.current.get(cacheKey)!
    }
    
    try {
      // 先获取出库组部门ID
      const departmentId = await getOutboundGroupDepartmentId()
      if (!departmentId) {
        console.warn('未找到出库组部门，无法加载装车人')
        return []
      }

      const params = new URLSearchParams({
        limit: '1000',
        sort: 'full_name',
        order: 'asc',
      })
      // 添加部门和角色过滤：只获取出库组且角色为叉车工的用户
      params.append('filter_department', departmentId)
      params.append('filter_role', 'wms_outbound_worker')
      if (search && search.trim()) {
        params.append('search', search.trim())
        params.append('unlimited', 'true')
      }
      
      const response = await fetch(`/api/users?${params.toString()}`)
      if (!response.ok) {
        console.error('加载装车人选项失败:', response.statusText)
        return []
      }
      
      const result = await response.json()
      const users = result.data || []
      
      const options = users.map((user: any) => ({
        label: user.full_name || user.username || `ID: ${user.id}`,
        value: String(user.id),
      }))
      
      // 缓存结果
      loadedByOptionsCacheRef.current.set(cacheKey, options)
      return options
    } catch (error) {
      console.error('加载装车人选项失败:', error)
      return []
    }
  }, [getOutboundGroupDepartmentId])

  // 加载 Trailer 选项
  const loadTrailerOptions = React.useCallback(async (search: string = '') => {
    try {
      const params = new URLSearchParams({
        limit: '1000',
        sort: 'trailer_code',
        order: 'asc',
      })
      if (search && search.trim()) {
        params.append('search', search.trim())
        params.append('unlimited', 'true')
      }
      
      const response = await fetch(`/api/trailers?${params.toString()}`)
      if (!response.ok) {
        console.error('加载 Trailer 选项失败:', response.statusText)
        return []
      }
      
      const result = await response.json()
      const trailers = result.data || []
      
      const options = trailers.map((trailer: any) => ({
        label: trailer.trailer_code || `ID: ${trailer.trailer_id}`,
        value: String(trailer.trailer_id),
      }))
      
      return options
    } catch (error) {
      console.error('加载 Trailer 选项失败:', error)
      return []
    }
  }, [])

  // 字段加载选项配置
  const fieldFuzzyLoadOptions = React.useMemo(() => ({
    loaded_by_name: loadLoadedByOptions,
    trailer_code: loadTrailerOptions,
  }), [loadLoadedByOptions, loadTrailerOptions])

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
      fieldFuzzyLoadOptions={fieldFuzzyLoadOptions}
      customActions={{
        onView: null, // 隐藏查看详情（null 表示隐藏）
        onAdd: undefined, // 隐藏新建
        onDelete: undefined, // 隐藏删除
      }}
    />
  )
}

