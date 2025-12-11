/**
 * 关联表筛选条件映射器
 * 用于将主表的筛选条件映射到关联表（如 orders, delivery_appointments）
 */

import { EntityConfig, FilterFieldConfig } from './types'
import { buildFilterConditions } from './filter-helper'

/**
 * 字段映射配置
 * 定义哪些字段来自哪个关联表
 */
export interface RelationFieldMapping {
  [fieldName: string]: {
    relationName: string // 关联表在 Prisma 中的名称（如 'orders', 'delivery_appointments'）
    dbFieldName: string // 数据库字段名（如 'customer_id', 'port_location_id'）
  }
}

/**
 * 构建关联表的筛选条件
 * 将主表的筛选条件转换为关联表的 where 条件
 */
export function buildRelationFilterConditions(
  config: EntityConfig,
  searchParams: URLSearchParams,
  fieldMapping: RelationFieldMapping
): any {
  const filterConditions = buildFilterConditions(config, searchParams)
  
  if (filterConditions.length === 0) {
    return {}
  }
  
  // 按关联表分组筛选条件
  const relationConditions: { [relationName: string]: any[] } = {}
  
  filterConditions.forEach((condition) => {
    Object.keys(condition).forEach((fieldName) => {
      const mapping = fieldMapping[fieldName]
      if (mapping) {
        // 这个字段来自关联表
        if (!relationConditions[mapping.relationName]) {
          relationConditions[mapping.relationName] = []
        }
        
        // 将字段名映射到关联表的字段名
        const relationCondition: any = {}
        relationCondition[mapping.dbFieldName] = condition[fieldName]
        relationConditions[mapping.relationName].push(relationCondition)
      }
    })
  })
  
  // 构建最终的 where 条件
  const where: any = {}
  Object.keys(relationConditions).forEach((relationName) => {
    const conditions = relationConditions[relationName]
    if (conditions.length === 1) {
      where[relationName] = conditions[0]
    } else if (conditions.length > 1) {
      // 多个条件使用 AND 组合
      where[relationName] = {
        AND: conditions,
      }
    }
  })
  
  return where
}

/**
 * 合并关联表筛选条件到主查询
 * 将关联表的筛选条件合并到主表的 where 条件中
 */
export function mergeRelationFilterConditions(
  mainWhere: any,
  relationWhere: any
): void {
  Object.keys(relationWhere).forEach((relationName) => {
    const relationCondition = relationWhere[relationName]
    
    if (mainWhere[relationName]) {
      // 如果主查询中已经有这个关联表的条件，需要合并
      if (mainWhere[relationName].AND) {
        // 如果已有 AND 条件，添加到 AND 数组中
        mainWhere[relationName].AND.push(relationCondition)
      } else {
        // 否则创建 AND 条件
        mainWhere[relationName] = {
          AND: [mainWhere[relationName], relationCondition],
        }
      }
    } else {
      // 直接添加关联表条件
      mainWhere[relationName] = relationCondition
    }
  })
}

