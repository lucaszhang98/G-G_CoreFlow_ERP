/**
 * Prisma 查询构建器 - 统一构建常用查询模式
 */

import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'

/**
 * 查询选项
 */
export interface QueryOptions {
  where?: any
  include?: any
  select?: any
  orderBy?: any
  take?: number
  skip?: number
}

/**
 * 构建分页查询
 */
export function buildPaginationQuery(
  page: number,
  limit: number,
  options: QueryOptions = {}
): QueryOptions {
  return {
    ...options,
    skip: (page - 1) * limit,
    take: limit,
  }
}

/**
 * 构建排序查询
 */
export function buildSortQuery(
  sortBy: string,
  sortOrder: 'asc' | 'desc' = 'asc',
  options: QueryOptions = {}
): QueryOptions {
  return {
    ...options,
    orderBy: {
      [sortBy]: sortOrder,
    },
  }
}

/**
 * 构建搜索查询（简单文本搜索）
 */
export function buildSearchQuery(
  searchFields: string[],
  searchTerm: string,
  existingWhere: any = {}
): any {
  if (!searchTerm || !searchFields.length) {
    return existingWhere
  }

  const searchConditions = searchFields.map(field => ({
    [field]: {
      contains: searchTerm,
      mode: 'insensitive' as Prisma.QueryMode,
    },
  }))

  return {
    ...existingWhere,
    OR: searchConditions,
  }
}

/**
 * 构建关系查询
 */
export function buildRelationQuery(
  relations: Record<string, any>,
  options: QueryOptions = {}
): QueryOptions {
  return {
    ...options,
    include: {
      ...options.include,
      ...relations,
    },
  }
}

/**
 * 构建选择字段查询
 */
export function buildSelectQuery(
  fields: string[],
  options: QueryOptions = {}
): QueryOptions {
  const select: Record<string, boolean> = {}
  fields.forEach(field => {
    select[field] = true
  })

  return {
    ...options,
    select: {
      ...options.select,
      ...select,
    },
  }
}

/**
 * 通用查询执行器
 */
export async function executeQuery<T>(
  model: string,
  options: QueryOptions
): Promise<T[]> {
  const prismaModel = (prisma as any)[model]
  if (!prismaModel) {
    throw new Error(`Prisma model ${model} not found`)
  }

  return prismaModel.findMany(options)
}

/**
 * 通用计数查询
 */
export async function executeCount(
  model: string,
  where?: any
): Promise<number> {
  const prismaModel = (prisma as any)[model]
  if (!prismaModel) {
    throw new Error(`Prisma model ${model} not found`)
  }

  return prismaModel.count({ where })
}

/**
 * 构建复合查询（分页 + 排序 + 搜索）
 */
export function buildCompositeQuery(
  params: {
    page?: number
    limit?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
    searchTerm?: string
    searchFields?: string[]
    where?: any
    include?: any
    select?: any
  }
): QueryOptions {
  let query: QueryOptions = {}

  // 应用 where 条件
  if (params.where) {
    query.where = params.where
  }

  // 应用搜索
  if (params.searchTerm && params.searchFields) {
    query.where = buildSearchQuery(
      params.searchFields,
      params.searchTerm,
      query.where
    )
  }

  // 应用排序
  if (params.sortBy) {
    query = buildSortQuery(params.sortBy, params.sortOrder, query)
  }

  // 应用分页
  if (params.page && params.limit) {
    query = buildPaginationQuery(params.page, params.limit, query)
  }

  // 应用 include
  if (params.include) {
    query.include = params.include
  }

  // 应用 select
  if (params.select) {
    query.select = params.select
  }

  return query
}

