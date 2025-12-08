/**
 * 关系字段选项加载工具
 * 用于从 API 加载关系字段的选项
 */

import { AdvancedSearchFieldConfig } from './types'

/**
 * 加载关系字段的选项
 */
export async function loadRelationOptions(
  field: AdvancedSearchFieldConfig
): Promise<Array<{ label: string; value: string }>> {
  if (!field.relation) {
    return []
  }

  try {
    // 根据关系配置构建 API 路径
    // 例如：customers -> /api/customers, carriers -> /api/carriers
    const modelName = field.relation.model
    const apiPath = `/api/${modelName}?unlimited=true`
    
    const response = await fetch(apiPath)
    if (!response.ok) {
      throw new Error(`加载${field.label}选项失败`)
    }

    const data = await response.json()
    const items = data.data || data || []

    // 提取选项
    const displayField = field.relation.displayField
    const valueField = field.relation.valueField || 'id'

    return items.map((item: any) => {
      const label = item[displayField] || String(item[valueField] || '')
      const value = String(item[valueField] || item.id || '')
      return { label, value }
    })
  } catch (error) {
    console.error(`加载关系字段选项失败 (${field.field}):`, error)
    return []
  }
}


