/**
 * Relation 字段筛选辅助函数
 * 为 relation 类型字段提供统一的筛选处理逻辑
 */

import { EntityConfig, FilterFieldConfig, FieldConfig } from './types'

/**
 * 获取 relation 字段的数据库字段名
 * 根据字段配置和数据库结构，返回正确的数据库字段名
 */
export function getRelationDbFieldName(
  filterField: FilterFieldConfig,
  fieldConfig: FieldConfig | undefined
): string {
  // 处理 location 类型字段（location 类型实际上是通过 ID 关联到 locations 表的）
  if (fieldConfig?.type === 'location') {
    // location 类型字段的数据库字段名通常是 {fieldKey}_id 或 location_id
    // 例如：origin_location -> origin_location_id, destination_location -> location_id
    if (filterField.field === 'destination_location') {
      return 'location_id'
    }
    return `${filterField.field}_id`
  }
  
  if (!fieldConfig || fieldConfig.type !== 'relation' || !fieldConfig.relation) {
    // 如果不是 relation 类型，返回原始字段名
    return filterField.field
  }

  const valueField = fieldConfig.relation.valueField || 'id'
  
  // 如果 valueField 是 'id'，需要根据字段名判断
  if (valueField === 'id') {
    // 如果字段名本身已经以 _id 结尾（如 user_id），直接使用
    if (filterField.field.endsWith('_id')) {
      return filterField.field
    }
    // 否则添加 _id 后缀（如 customer -> customer_id）
    return `${filterField.field}_id`
  }
  
  // 如果 valueField 是其他格式（如 carrier_id），直接使用
  return valueField
}

/**
 * 转换 relation 字段的筛选值
 * 将字符串 ID 转换为 BigInt（如果字段是 ID 类型）
 */
export function convertRelationFilterValue(
  filterValue: string,
  dbFieldName: string,
  fieldConfig: FieldConfig | undefined
): bigint | string | null {
  // 验证值是否有效
  if (!filterValue || filterValue === '__all__' || filterValue.trim() === '') {
    return null
  }

  // 如果是 ID 字段（以 _id 结尾或字段名是 id），转换为 BigInt
  if (dbFieldName.endsWith('_id') || dbFieldName === 'id') {
    // 确保是有效的数字字符串
    if (typeof filterValue === 'string' && /^\d+$/.test(filterValue)) {
      try {
        return BigInt(filterValue)
      } catch (e) {
        console.error(`[convertRelationFilterValue] BigInt 转换失败: ${filterValue} (字段: ${dbFieldName})`, e)
        return null
      }
    } else {
      console.error(`[convertRelationFilterValue] 无效的 ID 值: ${filterValue} (字段: ${dbFieldName})`)
      return null
    }
  }

  // 其他类型直接返回字符串
  return filterValue
}

/**
 * 构建 relation 字段的筛选条件
 * 返回 Prisma where 条件对象
 */
export function buildRelationFilterCondition(
  filterField: FilterFieldConfig,
  filterValue: string,
  config: EntityConfig
): any | null {
  const fieldConfig = config.fields[filterField.field]
  
  // 获取数据库字段名
  const dbFieldName = getRelationDbFieldName(filterField, fieldConfig)
  
  // 转换筛选值
  const convertedValue = convertRelationFilterValue(filterValue, dbFieldName, fieldConfig)
  
  if (convertedValue === null) {
    return null
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`[buildRelationFilterCondition] 构建 relation 筛选: ${filterField.field} -> ${dbFieldName} = ${convertedValue} (类型: ${typeof convertedValue})`)
  }

  return { [dbFieldName]: convertedValue }
}

