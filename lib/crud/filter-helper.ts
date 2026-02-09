/**
 * 筛选逻辑辅助函数
 * 统一的筛选逻辑处理，可以被通用 API 和自定义 API 复用
 */

import { EntityConfig, FilterFieldConfig } from './types'
import { buildRelationFilterCondition } from './relation-filter-helper'

/**
 * 安全地序列化包含 BigInt 的对象
 * 将 BigInt 值转换为字符串以便 JSON.stringify 可以处理
 */
function safeStringify(obj: any, space?: number): string {
  return JSON.stringify(
    obj,
    (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString() + 'n'
      }
      return value
    },
    space
  )
}

/**
 * 从 URL 参数中提取筛选条件
 * 返回 Prisma where 条件对象
 */
export function buildFilterConditions(
  config: EntityConfig,
  searchParams: URLSearchParams
): any[] {
  const filterConditions: any[] = []
  
  if (!config.list.filterFields || config.list.filterFields.length === 0) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[buildFilterConditions] 没有 filterFields 配置')
    }
    return filterConditions
  }
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[buildFilterConditions] 开始构建筛选条件，filterFields 数量:', config.list.filterFields.length)
  }
  
  config.list.filterFields.forEach((filterField) => {
    if (filterField.type === 'select') {
      const filterValue = searchParams.get(`filter_${filterField.field}`)
      // 忽略 "__all__" 值（表示清除筛选）
      if (filterValue && filterValue !== '__all__') {
        // 获取字段配置，判断字段类型
        const fieldConfig = config.fields[filterField.field]
        
        // 特殊处理：delivery_location 在某些表中是字符串类型（如 order_detail），但在其他表中是通过 ID 关联的（如 inventory_lots）
        // 只有在字段类型不是 relation 时才使用字符串筛选
        if (filterField.field === 'delivery_location' && fieldConfig?.type !== 'relation') {
          if (filterField.relation) {
            // 使用 relation 筛选，但值需要转换为字符串（因为 delivery_location 是字符串字段）
            // 直接使用字符串值，不转换为 BigInt
            filterConditions.push({ [filterField.field]: String(filterValue) })
            if (process.env.NODE_ENV === 'development') {
              console.log(`[buildFilterConditions] 添加 delivery_location relation 筛选（字符串）: ${filterField.field} = ${String(filterValue)}`)
            }
          } else {
            // delivery_location 是字符串字段，直接使用字符串匹配
            filterConditions.push({ [filterField.field]: filterValue })
            if (process.env.NODE_ENV === 'development') {
              console.log(`[buildFilterConditions] 添加 delivery_location 字符串筛选: ${filterField.field} = ${filterValue}`)
            }
          }
        }
        // 如果是 relation 类型或 location 类型，使用统一的 relation 筛选处理
        else if (fieldConfig?.type === 'relation' || (fieldConfig?.type === 'location' && filterField.relation)) {
          const condition = buildRelationFilterCondition(filterField, filterValue, config)
          if (condition) {
            filterConditions.push(condition)
          } else if (process.env.NODE_ENV === 'development') {
            console.warn(`[buildFilterConditions] relation 筛选条件构建失败: ${filterField.field} = ${filterValue}`)
          }
        } else {
          // 非 relation 类型的 select 字段处理
          let dbFieldName = filterField.field
          let filterValueToUse: any = filterValue
          
          // 如果是 boolean 类型，将字符串 'true'/'false' 转换为布尔值
          if (fieldConfig?.type === 'boolean' || fieldConfig?.type === 'checkbox') {
            filterValueToUse = filterValue === 'true'
          }
          
          // 特殊处理：零/非零筛选（用于 remaining_pallet_count、unbooked_pallet_count）
          if (filterValue === 'zero' || filterValue === 'non_zero') {
            if (filterValue === 'zero') {
              filterConditions.push({ [dbFieldName]: { equals: 0 } })
            } else {
              filterConditions.push({ [dbFieldName]: { not: 0 } })
            }
            if (process.env.NODE_ENV === 'development') {
              console.log(`[buildFilterConditions] 添加零/非零筛选: ${dbFieldName} ${filterValue === 'zero' ? '= 0' : '!= 0'}`)
            }
          }
          // 特殊处理：100%/非100%筛选（用于 delivery_progress）
          // 注意：delivery_progress 是 Decimal 类型，数据库中存储的是小数形式（0.00 到 1.00），而不是百分比（0 到 100）
          // 已完成 = 1.00（表示 100%），未完成 = 非 1.00（包括 null 和小于 1.00 的值）
          else if (filterValue === 'complete' || filterValue === 'incomplete') {
            if (filterValue === 'complete') {
              // 已完成：等于 1.00（表示 100%）
              filterConditions.push({ [dbFieldName]: { equals: 1 } })
            } else {
              // 未完成：不等于 1.00（包括 null 和小于 1.00 的值）
              // 在 Prisma 中，not: 1 不会匹配 null，所以需要明确处理 null
              // 使用 OR 条件：要么不等于 1，要么为 null
              filterConditions.push({
                OR: [
                  { [dbFieldName]: { not: { equals: 1 } } },
                  { [dbFieldName]: null }
                ]
              })
            }
            if (process.env.NODE_ENV === 'development') {
              console.log(`[buildFilterConditions] 添加100%/非100%筛选: ${dbFieldName} ${filterValue === 'complete' ? '= 1.00 (100%)' : '!= 1.00 (包括 null)'}`)
            }
          }
          // 普通 select 筛选
          else {
            // 处理多选：如果 filterField.multiple 为 true，且 filterValue 包含逗号，则使用 OR 条件
            if (filterField.multiple && filterValue.includes(',')) {
              const values = filterValue.split(',').map(v => v.trim()).filter(v => v)
              if (values.length > 0) {
                // 对于文本类型的字段，使用 contains 进行模糊匹配
                if (fieldConfig?.type === 'text' && !fieldConfig.options) {
                  const orConditions = values.map(v => ({ [dbFieldName]: { contains: v, mode: 'insensitive' as const } }))
                  filterConditions.push({ OR: orConditions })
                  if (process.env.NODE_ENV === 'development') {
                    console.log(`[buildFilterConditions] 添加多选文本 select 筛选: ${dbFieldName} OR [${values.join(', ')}]`)
                  }
                } else {
                  // 对于有选项的字段，使用精确匹配
                  const orConditions = values.map(v => ({ [dbFieldName]: v }))
                  filterConditions.push({ OR: orConditions })
                  if (process.env.NODE_ENV === 'development') {
                    console.log(`[buildFilterConditions] 添加多选 select 筛选: ${dbFieldName} OR [${values.join(', ')}]`)
                  }
                }
              }
            } else {
              // 单选或单个值
              // 对于文本类型的字段（如 delivery_nature, delivery_location），使用 contains 进行模糊匹配
              if (fieldConfig?.type === 'text' && !fieldConfig.options) {
                filterConditions.push({ [dbFieldName]: { contains: filterValueToUse, mode: 'insensitive' } })
                if (process.env.NODE_ENV === 'development') {
                  console.log(`[buildFilterConditions] 添加文本 select 筛选: ${dbFieldName} contains ${filterValueToUse}`)
                }
              } else {
                filterConditions.push({ [dbFieldName]: filterValueToUse })
                if (process.env.NODE_ENV === 'development') {
                  console.log(`[buildFilterConditions] 添加 select 筛选: ${dbFieldName} = ${filterValueToUse} (类型: ${typeof filterValueToUse})`)
                }
              }
            }
          }
        }
      } else if (process.env.NODE_ENV === 'development') {
        console.log(`[buildFilterConditions] 跳过 select 筛选 ${filterField.field}: 值为空或 __all__`)
      }
    } else if (filterField.type === 'dateRange') {
      const dateFrom = searchParams.get(`filter_${filterField.field}_from`)
      const dateTo = searchParams.get(`filter_${filterField.field}_to`)
      if (dateFrom || dateTo) {
        const dateCondition: any = {}
        if (dateFrom) {
          dateCondition.gte = new Date(dateFrom)
        }
        if (dateTo) {
          // 结束日期应该包含整天，所以设置为当天的 23:59:59
          const endDate = new Date(dateTo)
          endDate.setHours(23, 59, 59, 999)
          dateCondition.lte = endDate
        }
        // 如果指定了多个日期字段，使用 OR 逻辑（同一筛选条件的多个字段）
        if (filterField.dateFields && filterField.dateFields.length > 0) {
          const dateFieldConditions: any[] = []
          filterField.dateFields.forEach((dateField) => {
            dateFieldConditions.push({ [dateField]: dateCondition })
          })
          // 同一筛选条件的多个字段使用 OR，但整个筛选条件与其他筛选条件使用 AND
          if (dateFieldConditions.length === 1) {
            filterConditions.push(dateFieldConditions[0])
          } else {
            filterConditions.push({ OR: dateFieldConditions })
          }
        } else {
          // 默认使用 filterField.field
          filterConditions.push({ [filterField.field]: dateCondition })
        }
        if (process.env.NODE_ENV === 'development') {
          console.log(`[buildFilterConditions] 添加 dateRange 筛选: ${filterField.field}`, dateCondition)
        }
      }
    } else if (filterField.type === 'numberRange') {
      const numMin = searchParams.get(`filter_${filterField.field}_min`)
      const numMax = searchParams.get(`filter_${filterField.field}_max`)
      if (numMin || numMax) {
        const numCondition: any = {}
        if (numMin) {
          numCondition.gte = Number(numMin)
        }
        if (numMax) {
          numCondition.lte = Number(numMax)
        }
        // 如果指定了多个数值字段，使用 OR 逻辑（同一筛选条件的多个字段）
        if (filterField.numberFields && filterField.numberFields.length > 0) {
          const numFieldConditions: any[] = []
          filterField.numberFields.forEach((numField) => {
            numFieldConditions.push({ [numField]: numCondition })
          })
          // 同一筛选条件的多个字段使用 OR，但整个筛选条件与其他筛选条件使用 AND
          if (numFieldConditions.length === 1) {
            filterConditions.push(numFieldConditions[0])
          } else {
            filterConditions.push({ OR: numFieldConditions })
          }
        } else {
          // 默认使用 filterField.field
          filterConditions.push({ [filterField.field]: numCondition })
        }
      }
    }
  })
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[buildFilterConditions] 构建完成，筛选条件数量:', filterConditions.length, '条件:', filterConditions)
  }
  
  return filterConditions
}

/**
 * 将筛选条件合并到 where 对象中
 */
export function mergeFilterConditions(
  where: any,
  filterConditions: any[]
): void {
  if (process.env.NODE_ENV === 'development') {
    console.log('[mergeFilterConditions] 开始合并筛选条件，条件数量:', filterConditions.length)
    console.log('[mergeFilterConditions] 当前 where 对象:', safeStringify(where, 2))
  }
  
  if (filterConditions.length > 0) {
    if (filterConditions.length === 1) {
      // 如果只有一个条件，直接合并到 where（避免不必要的 AND 包装）
      Object.assign(where, filterConditions[0])
      if (process.env.NODE_ENV === 'development') {
        console.log('[mergeFilterConditions] 单个条件，直接合并:', filterConditions[0])
      }
    } else {
      // 如果已有 where.AND，合并到其中；否则创建新的 AND 数组
      if (where.AND) {
        where.AND = [...where.AND, ...filterConditions]
        if (process.env.NODE_ENV === 'development') {
          console.log('[mergeFilterConditions] 合并到现有 AND 数组')
        }
      } else {
        where.AND = filterConditions
        if (process.env.NODE_ENV === 'development') {
          console.log('[mergeFilterConditions] 创建新的 AND 数组')
        }
      }
    }
    if (process.env.NODE_ENV === 'development') {
      console.log('[mergeFilterConditions] 合并后的 where 对象:', safeStringify(where, 2))
    }
  } else if (process.env.NODE_ENV === 'development') {
    console.log('[mergeFilterConditions] 没有筛选条件需要合并')
  }
}

