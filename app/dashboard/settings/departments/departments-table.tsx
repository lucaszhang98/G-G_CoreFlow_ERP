"use client"

import * as React from "react"
import { EntityTable } from "@/components/crud/entity-table"
import { departmentConfig } from "@/lib/crud/configs/departments"

export function DepartmentsTable() {
  // 加载部门选项（用于上级部门字段）
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

  // 加载用户选项（用于负责人字段）
  const loadUsersOptions = React.useCallback(async () => {
    try {
      const response = await fetch('/api/users?limit=1000&sort=name&order=asc')
      if (!response.ok) {
        throw new Error('获取用户列表失败')
      }
      const result = await response.json()
      const users = result.data || []
      return users.map((user: any) => ({
        label: user.name || user.username || `用户 ${user.id}`,
        value: String(user.id),
      }))
    } catch (error) {
      console.error('加载用户选项失败:', error)
      return []
    }
  }, [])

  // 字段选项加载函数（用于批量编辑和行内编辑中的关系字段）
  const fieldLoadOptions = React.useMemo(() => ({
    parent_id: loadDepartmentsOptions,
    manager_id: loadUsersOptions,
  }), [loadDepartmentsOptions, loadUsersOptions])

  return (
    <EntityTable 
      config={departmentConfig}
      fieldLoadOptions={fieldLoadOptions}
    />
  )
}


