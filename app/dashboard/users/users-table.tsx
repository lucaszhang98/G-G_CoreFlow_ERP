"use client"

import * as React from "react"
import { EntityTable } from "@/components/crud/entity-table"
import { userConfig } from "@/lib/crud/configs/users"

export function UsersTable() {
  // 加载部门选项（用于部门字段）
  const loadDepartmentsOptions = React.useCallback(async () => {
    try {
      const response = await fetch('/api/departments?limit=1000&sort=name&order=asc')
      if (!response.ok) {
        throw new Error('获取部门列表失败')
      }
      const result = await response.json()
      const departments = result.data || []
      return departments.map((dept: any) => ({
        label: dept.name || dept.code || `部门 ${dept.id}`,
        value: String(dept.id),
      }))
    } catch (error) {
      console.error('加载部门选项失败:', error)
      return []
    }
  }, [])

  // 字段选项加载函数（用于批量编辑和行内编辑中的关系字段）
  const fieldLoadOptions = React.useMemo(() => ({
    department_id: loadDepartmentsOptions,
  }), [loadDepartmentsOptions])

  return (
    <EntityTable 
      config={userConfig}
      fieldLoadOptions={fieldLoadOptions}
    />
  )
}


