/**
 * 搜索配置自动生成工具
 * 根据字段定义自动生成 filterFields 和 advancedSearchFields
 */

import { EntityConfig, FilterFieldConfig, AdvancedSearchFieldConfig, FieldConfig } from './types'

/**
 * 自动生成 Filter 字段配置
 * 提取所有 select、relation、date、datetime 字段（排除 hidden 字段）
 */
export function generateFilterFields(config: EntityConfig): FilterFieldConfig[] {
  const filterFields: FilterFieldConfig[] = []
  
  Object.entries(config.fields).forEach(([fieldKey, fieldConfig]) => {
    // 排除隐藏字段
    if (fieldConfig.hidden) {
      return
    }
    
    // 提取 select 类型字段
    if (fieldConfig.type === 'select' && fieldConfig.options) {
      filterFields.push({
        field: fieldKey,
        label: fieldConfig.label,
        type: 'select',
        options: fieldConfig.options,
      })
    }
    
    // 提取 badge 类型字段（badge 通常也有 options，应该作为筛选字段）
    if (fieldConfig.type === 'badge' && fieldConfig.options) {
      filterFields.push({
        field: fieldKey,
        label: fieldConfig.label,
        type: 'select',
        options: fieldConfig.options,
      })
    }
    
    // 提取 relation 类型字段（排除 carrier，因为 orders 表里没有这个字段）
    if (fieldConfig.type === 'relation' && fieldConfig.relation && fieldKey !== 'carrier') {
      filterFields.push({
        field: fieldKey,
        label: fieldConfig.label,
        type: 'select',
        relation: {
          model: fieldConfig.relation.model,
          displayField: fieldConfig.relation.displayField,
          valueField: fieldConfig.relation.valueField,
        },
      })
    }
    
    // 提取 location 类型字段（location 类型实际上是通过 ID 关联到 locations 表的）
    if (fieldConfig.type === 'location') {
      filterFields.push({
        field: fieldKey,
        label: fieldConfig.label,
        type: 'select',
        relation: {
          model: 'locations',
          displayField: 'name',
          valueField: 'location_id',
        },
        // 传递 locationType 到 filterField，用于过滤位置选项
        locationType: fieldConfig.locationType,
      })
    }
    
    // 提取 date 类型字段（使用 dateRange）
    if (fieldConfig.type === 'date') {
      filterFields.push({
        field: fieldKey,
        label: fieldConfig.label,
        type: 'dateRange',
        dateFields: [fieldKey],
      })
    }
    
    // 提取 datetime 类型字段（使用 dateRange）
    if (fieldConfig.type === 'datetime') {
      filterFields.push({
        field: fieldKey,
        label: fieldConfig.label,
        type: 'dateRange',
        dateFields: [fieldKey],
      })
    }
    
    // 提取 boolean 类型字段（使用 select）
    if (fieldConfig.type === 'boolean' || fieldConfig.type === 'checkbox') {
      filterFields.push({
        field: fieldKey,
        label: fieldConfig.label,
        type: 'select',
        options: [
          { label: '是', value: 'true' },
          { label: '否', value: 'false' },
        ],
      })
    }
  })
  
  return filterFields
}

/**
 * 自动生成高级搜索字段配置
 * 基于 config.list.columns 中显示的字段生成（包括原始字段、读取字段、计算字段）
 * 这是专业系统的标准做法：只搜索表格中实际显示的字段
 */
export function generateAdvancedSearchFields(config: EntityConfig): AdvancedSearchFieldConfig[] {
  const advancedSearchFields: AdvancedSearchFieldConfig[] = []
  
  // 获取表格中显示的列（columns）
  const displayColumns = config.list.columns || []
  
  // 排除 ID 字段（通常是审计字段，不需要搜索）
  const idField = config.idField || 'id'
  const columnsToSearch = displayColumns.filter(col => col !== idField)
  
  // 基于 columns 中显示的字段生成高级搜索配置
  columnsToSearch.forEach((fieldKey) => {
    const fieldConfig = config.fields[fieldKey]
    
    // 如果字段在 columns 中但不在 fields 中定义，跳过（这种情况应该很少）
    if (!fieldConfig) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[generateAdvancedSearchFields] 字段 ${fieldKey} 在 columns 中但未在 fields 中定义，跳过高级搜索配置`)
      }
      return
    }
    
    // 排除隐藏字段（虽然理论上 columns 中不应该有 hidden 字段，但为了安全起见还是检查一下）
    if (fieldConfig.hidden) {
      return
    }
    
    // 根据字段类型映射到高级搜索类型
    let searchType: AdvancedSearchFieldConfig['type'] | null = null
    let searchConfig: Partial<AdvancedSearchFieldConfig> = {
      field: fieldKey,
      label: fieldConfig.label,
    }
    
    switch (fieldConfig.type) {
      case 'text':
      case 'email':
      case 'phone':
      case 'textarea':
        searchType = 'text'
        break
        
      case 'number':
      case 'currency':
        // 数字和货币类型使用 numberRange（可以只填一个值）
        searchType = 'numberRange'
        searchConfig.numberFields = [fieldKey]
        break
        
      case 'date':
        // 日期类型使用 dateRange（可以只填一个值）
        searchType = 'dateRange'
        searchConfig.dateFields = [fieldKey]
        break
        
      case 'datetime':
        // 日期时间类型使用 dateRange（可以只填一个值）
        searchType = 'dateRange'
        searchConfig.dateFields = [fieldKey]
        break
        
      case 'select':
        // select 类型保持为 select
        searchType = 'select'
        if (fieldConfig.options) {
          searchConfig.options = fieldConfig.options
        }
        break
        
      case 'relation':
        // relation 类型转换为 select（带 relation 配置）
        searchType = 'select'
        if (fieldConfig.relation) {
          searchConfig.relation = {
            model: fieldConfig.relation.model,
            displayField: fieldConfig.relation.displayField,
            valueField: fieldConfig.relation.valueField,
          }
        }
        break
        
      case 'badge':
        // badge 类型通常有 options，转换为 select
        searchType = 'select'
        if (fieldConfig.options) {
          searchConfig.options = fieldConfig.options
        }
        break
        
      case 'boolean':
      case 'checkbox':
        // boolean 和 checkbox 类型转换为 select
        searchType = 'select'
        searchConfig.options = [
          { label: '是', value: 'true' },
          { label: '否', value: 'false' },
        ]
        break
        
      case 'location':
        // location 类型转换为 select（带 relation 配置）
        searchType = 'select'
        searchConfig.relation = {
          model: 'locations',
          displayField: 'name',
          valueField: 'location_id',
        }
        break
        
      // 其他类型暂不支持，跳过
      default:
        // 对于未定义的类型，如果是计算字段，尝试根据字段名推断类型
        if (fieldConfig.computed) {
          // 计算字段通常是数字类型（如 delivery_progress, container_volume）
          // 尝试推断为 numberRange
          if (fieldKey.includes('progress') || fieldKey.includes('volume') || fieldKey.includes('amount') || fieldKey.includes('count')) {
            searchType = 'numberRange'
            searchConfig.numberFields = [fieldKey]
          } else {
            // 其他计算字段暂不支持，跳过
            return
          }
        } else {
          return
        }
    }
    
    if (searchType) {
      advancedSearchFields.push({
        ...searchConfig,
        type: searchType,
      } as AdvancedSearchFieldConfig)
    }
  })
  
  return advancedSearchFields
}

/**
 * 增强实体配置，自动填充 filterFields 和 advancedSearchFields
 * 
 * 为了保持系统一致性，所有模块都使用自动生成的配置：
 * - filterFields: 如果未配置则自动生成（允许手动覆盖特定需求）
 * - advancedSearchFields: 始终自动生成，包含所有 columns 中显示的字段（保持一致性，避免遗漏）
 */
export function enhanceConfigWithSearchFields(config: EntityConfig): EntityConfig {
  // 深拷贝配置，避免修改原始配置
  const enhancedConfig: EntityConfig = {
    ...config,
    list: {
      ...config.list,
    },
  }
  
  // 自动生成 filterFields（如果未配置，允许手动覆盖特定需求）
  if (!enhancedConfig.list.filterFields || enhancedConfig.list.filterFields.length === 0) {
    enhancedConfig.list.filterFields = generateFilterFields(enhancedConfig)
  }
  
  // 始终自动生成 advancedSearchFields，确保所有模块都包含所有显示字段
  // 这样可以保持一致性，避免手动配置时遗漏字段，也方便后续添加新页面
  enhancedConfig.list.advancedSearchFields = generateAdvancedSearchFields(enhancedConfig)
  
  return enhancedConfig
}

