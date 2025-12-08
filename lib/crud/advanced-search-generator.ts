/**
 * 高级搜索字段自动生成工具
 * 从实体配置中自动生成高级搜索字段，包含所有非隐藏字段
 */

import { EntityConfig, AdvancedSearchFieldConfig, FieldConfig } from './types'
import { filterAuditFields } from './constants'

/**
 * 根据字段类型推断高级搜索字段类型
 */
function inferAdvancedSearchType(fieldConfig: FieldConfig): AdvancedSearchFieldConfig['type'] {
  switch (fieldConfig.type) {
    case 'text':
    case 'textarea':
      return 'text'
    case 'number':
    case 'currency':
      return 'number'
    case 'date':
      return 'date'
    case 'datetime':
      return 'datetime'
    case 'boolean':
    case 'checkbox':
      return 'select' // boolean 字段使用 select 类型，选项为 true/false
    case 'relation':
      return 'select' // 关系字段使用 select 类型
    case 'location':
      return 'select' // 位置字段使用 select 类型
    case 'badge':
      return 'text' // badge 字段使用文本搜索
    default:
      return 'text'
  }
}

/**
 * 自动生成高级搜索字段配置
 * 包含所有非隐藏、非计算字段
 */
export function generateAdvancedSearchFields(
  config: EntityConfig
): AdvancedSearchFieldConfig[] {
  const fields: AdvancedSearchFieldConfig[] = []
  
  // 获取所有非隐藏字段（排除审计字段）
  const allFields = Object.entries(config.fields)
    .filter(([fieldKey, fieldConfig]) => {
      // 排除隐藏字段
      if (fieldConfig.hidden) return false
      // 排除计算字段（通常不能搜索）
      if (fieldConfig.computed) return false
      // 排除主键字段（通常不需要搜索）
      if (fieldKey === config.idField || fieldKey === 'id') return false
      return true
    })
  
  // 按字段顺序排序（使用 formFields 的顺序，如果存在）
  const fieldOrder = config.formFields || []
  const sortedFields = allFields.sort(([keyA], [keyB]) => {
    const indexA = fieldOrder.indexOf(keyA)
    const indexB = fieldOrder.indexOf(keyB)
    if (indexA === -1 && indexB === -1) return 0
    if (indexA === -1) return 1
    if (indexB === -1) return -1
    return indexA - indexB
  })
  
  sortedFields.forEach(([fieldKey, fieldConfig]) => {
    const searchType = inferAdvancedSearchType(fieldConfig)
    
    // 对于数字和日期字段，使用范围搜索更实用
    if (fieldConfig.type === 'number' || fieldConfig.type === 'currency') {
      fields.push({
        field: fieldKey,
        label: fieldConfig.label,
        type: 'numberRange',
        numberFields: [fieldKey],
      })
    } else if (fieldConfig.type === 'date') {
      fields.push({
        field: fieldKey,
        label: fieldConfig.label,
        type: 'dateRange',
        dateFields: [fieldKey],
      })
    } else if (fieldConfig.type === 'datetime') {
      // datetime 字段也使用 dateRange（只比较日期部分）
      fields.push({
        field: fieldKey,
        label: fieldConfig.label,
        type: 'dateRange',
        dateFields: [fieldKey],
      })
    } else if (fieldConfig.type === 'boolean' || fieldConfig.type === 'checkbox') {
      // boolean 字段使用 select
      fields.push({
        field: fieldKey,
        label: fieldConfig.label,
        type: 'select',
        options: [
          { label: '是', value: 'true' },
          { label: '否', value: 'false' },
        ],
      })
    } else if (fieldConfig.type === 'relation' && fieldConfig.relation) {
      // 关系字段使用 select，但需要动态加载选项
      fields.push({
        field: fieldKey,
        label: fieldConfig.label,
        type: 'select',
        relation: {
          model: fieldConfig.relation.model,
          displayField: fieldConfig.relation.displayField,
          valueField: fieldConfig.relation.valueField,
        },
      })
    } else {
      // 其他字段使用文本搜索
      fields.push({
        field: fieldKey,
        label: fieldConfig.label,
        type: searchType,
      })
    }
  })
  
  return fields
}

/**
 * 获取高级搜索字段（如果配置了则使用配置，否则自动生成）
 */
export function getAdvancedSearchFields(config: EntityConfig): AdvancedSearchFieldConfig[] {
  // 如果已经配置了高级搜索字段，直接使用
  if (config.list.advancedSearchFields && config.list.advancedSearchFields.length > 0) {
    return config.list.advancedSearchFields
  }
  
  // 否则自动生成
  return generateAdvancedSearchFields(config)
}


