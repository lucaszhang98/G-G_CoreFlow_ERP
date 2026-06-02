/**
 * 通用 CRUD API 处理函数
 * 
 * 使用统一的框架处理所有 CRUD 操作，减少代码重复
 * 支持数据转换、查询构建、错误处理等通用功能
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  checkAuth,
  checkPermission,
  WMS_FULL_ACCESS_PERMISSION_OPTIONS,
  parsePaginationParams,
  buildPaginationResponse,
  handleValidationError,
  handleError,
  serializeBigInt,
} from '@/lib/api/helpers'
import { applyTransform, applyTransformList } from '@/lib/api/transformers'
import { resolveParams, withApiHandler } from '@/lib/api/middleware'
import { EntityConfig } from './types'
import { getSchema } from './schema-loader'
import { buildRelationFilterCondition } from './relation-filter-helper'
import { enhanceConfigWithSearchFields } from './search-config-generator'
import prisma from '@/lib/prisma'
import { calculateUnloadDate } from '@/lib/utils/calculate-unload-date'
import {
  ORDER_STATUSES_EXCLUDED_FROM_OPERATIONAL_LISTS,
  ORDER_STATUS_CANCELLED,
  parseIncludeArchived,
  ordersWhereRootExcludeCancelledOnly,
} from '@/lib/orders/order-visibility'
import { purgeOperationalDataForCancelledOrder } from '@/lib/orders/cancelled-order-cleanup'
import { syncAppointmentEstimatedWindowPeriodForOrder } from '@/lib/oms/sync-appointment-estimated-window-period'
import {
  applyPickupDateEnteredAtToOrderUpdate,
  hasPickupDateValue,
} from '@/lib/oms/pickup-date-entered'
import { applyOrderFistFromCustomerOnWrite } from '@/lib/oms/sync-order-fist-from-customer'
import { shouldPaymentWriteOff } from '@/lib/finance/payment-write-off-sync'
import { syncInboundPlannedUnloadAtByPickupState } from '@/lib/wms/sync-inbound-planned-unload-from-pickup'

/**
 * 获取 Prisma 模型
 */
function checkEntityPermission(allowedRoles: string[], config: EntityConfig) {
  const wms = Boolean(config.apiPath?.startsWith('/api/wms'))
  return checkPermission(
    allowedRoles,
    wms ? WMS_FULL_ACCESS_PERMISSION_OPTIONS : undefined
  )
}

async function buildListSummary(
  prismaModel: { aggregate: (args: { where: unknown; _sum: Record<string, boolean> }) => Promise<{ _sum: Record<string, unknown> }> },
  where: unknown,
  aggregates?: EntityConfig['list']['listAggregates']
): Promise<Record<string, number>> {
  const summary: Record<string, number> = {}
  if (!aggregates?.length) return summary
  for (const agg of aggregates) {
    if ((agg.op ?? 'sum') !== 'sum') continue
    const result = await prismaModel.aggregate({
      where,
      _sum: { [agg.field]: true },
    })
    const raw = result._sum?.[agg.field]
    summary[agg.key] = raw != null && raw !== '' ? Number(raw) : 0
  }
  return summary
}

function getPrismaModel(config: EntityConfig) {
  const modelName = config.prisma?.model || config.name
  let prismaModel = (prisma as any)[modelName]
  if (!prismaModel) {
    // 尝试复数形式
    const pluralModel = modelName + 's'
    prismaModel = (prisma as any)[pluralModel]
  }
  if (!prismaModel) {
    throw new Error(`Prisma model ${modelName} not found`)
  }
  return prismaModel
}

/**
 * 创建通用 GET 列表处理函数
 */
export function createListHandler(config: EntityConfig) {
  return async (request: NextRequest) => {
    try {
      // 增强配置，确保 filterFields 和 advancedSearchFields 已生成
      const enhancedConfig = enhanceConfigWithSearchFields(config)
      
      // 检查权限
      const permissionResult = await checkEntityPermission(
        enhancedConfig.permissions.list,
        enhancedConfig
      )
      if (permissionResult.error) return permissionResult.error

      const searchParams = request.nextUrl.searchParams
      // 对于主数据搜索，如果有搜索条件，允许更大的limit（通过unlimited参数）
      // 默认maxLimit为100，但可以通过unlimited=true来支持更大的limit
      let { page, limit, sort, order } = parsePaginationParams(
        searchParams,
        enhancedConfig.list.defaultSort,
        enhancedConfig.list.defaultOrder,
        100 // 默认最大limit为100
      )
      const search = searchParams.get('search') || ''

      // 构建查询条件
      const where: any = {}
      
      // 简单搜索条件（模糊搜索）
      if (search) {
        const searchConditions = (enhancedConfig.list.searchFields ?? [])
          .map(field => {
            const fieldConfig = enhancedConfig.fields[field]
            if (fieldConfig?.relation) {
              // 关系字段搜索需要特殊处理
              return null
            }
            return {
              [field]: { contains: search, mode: 'insensitive' as const }
            }
          })
          .filter((condition): condition is any => condition !== null)

        // 发票：同时按关联订单柜号 order_number 模糊搜（与发票号 OR）
        if (
          enhancedConfig.prisma?.model === 'invoices' &&
          search.trim()
        ) {
          searchConditions.push({
            orders: {
              order_number: { contains: search, mode: 'insensitive' as const },
            },
          })
        }

        // 应收：按关联账单发票号模糊搜
        if (
          enhancedConfig.prisma?.model === 'receivables' &&
          search.trim()
        ) {
          searchConditions.push({
            invoices: {
              invoice_number: { contains: search, mode: 'insensitive' as const },
            },
          })
        }

        // 只有当有有效的搜索条件时才设置 where.OR
        if (searchConditions.length > 0) {
          where.OR = searchConditions
        }
      }

      // 筛选条件（快速筛选）
      if (enhancedConfig.list.filterFields) {
        enhancedConfig.list.filterFields.forEach((filterField) => {
          if (filterField.type === 'select') {
            const filterValue = searchParams.get(`filter_${filterField.field}`)
            
            // 开发环境：输出调试信息
            if (process.env.NODE_ENV === 'development' && filterValue) {
              console.log(`[createListHandler] 筛选字段: ${filterField.field}, 值: ${filterValue}`)
            }
            
            // 忽略 "__all__" 值（表示清除筛选）
            if (filterValue && filterValue !== '__all__') {
              // 检查是否是 relation 字段
              const fieldConfig = enhancedConfig.fields[filterField.field]
              if (fieldConfig?.type === 'relation' || fieldConfig?.type === 'location') {
                // 使用辅助函数构建 relation 筛选条件
                const relationCondition = buildRelationFilterCondition(filterField, filterValue, enhancedConfig)
                if (relationCondition) {
                  Object.assign(where, relationCondition)
                }
              } else {
                // 特殊处理：预约状态筛选
                if (filterField.field === 'booking_status') {
                  if (filterValue === 'unbooked') {
                    // 有未约板数：remaining_pallets > 0
                    where.remaining_pallets = { gt: 0 }
                  } else if (filterValue === 'fully_booked') {
                    // 已约满：remaining_pallets = 0
                    where.remaining_pallets = 0
                  } else if (filterValue === 'overbooked') {
                    // 超约：remaining_pallets < 0
                    where.remaining_pallets = { lt: 0 }
                  }
                  
                  if (process.env.NODE_ENV === 'development') {
                    console.log(`[createListHandler] 设置预约状态筛选条件: ${filterValue}`)
                  }
                } else if (
                  enhancedConfig.prisma?.model === 'receivables' &&
                  filterField.field === 'invoice_type'
                ) {
                  // 应收：按关联账单的账单类型（直送/拆柜/负数/仓储）
                  where.invoices = { invoice_type: filterValue }
                } else {
                  // 普通 select 字段（包括状态）
                  where[filterField.field] = filterValue
                  
                  if (process.env.NODE_ENV === 'development') {
                    console.log(`[createListHandler] 设置筛选条件: ${filterField.field} = ${filterValue}`)
                  }
                }
              }
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
              // 如果一个filter指定了多个日期字段（如"任意日期"filter匹配order_date或lfd_date），使用OR逻辑
              // 如果只有一个dateField，直接设置AND条件
              if (filterField.dateFields && filterField.dateFields.length > 1) {
                // 多个dateFields：在filter内部使用OR逻辑（这个filter匹配多个日期字段中的任一个）
                // 但不同filter之间仍然是AND逻辑
                const orConditions = filterField.dateFields.map((dateField) => ({
                  [dateField]: dateCondition
                }))
                // 将这个filter的OR条件作为一个整体添加到where中
                if (!where.AND) where.AND = []
                where.AND.push({ OR: orConditions })
              } else if (filterField.dateFields && filterField.dateFields.length === 1) {
                // 单个dateField：直接设置AND条件
                where[filterField.dateFields[0]] = dateCondition
              } else {
                // 默认使用 filterField.field
                where[filterField.field] = dateCondition
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
              // 如果一个filter指定了多个数值字段，使用OR逻辑
              // 如果只有一个numberField，直接设置AND条件
              if (filterField.numberFields && filterField.numberFields.length > 1) {
                // 多个numberFields：在filter内部使用OR逻辑
                const orConditions = filterField.numberFields.map((numField) => ({
                  [numField]: numCondition
                }))
                // 将这个filter的OR条件作为一个整体添加到where中
                if (!where.AND) where.AND = []
                where.AND.push({ OR: orConditions })
              } else if (filterField.numberFields && filterField.numberFields.length === 1) {
                // 单个numberField：直接设置AND条件
                where[filterField.numberFields[0]] = numCondition
              } else {
                // 默认使用 filterField.field
                where[filterField.field] = numCondition
              }
            }
          }
        })
      }

      // 高级搜索条件（多条件组合）
      const advancedLogic = searchParams.get('advanced_logic') || 'AND'
      if (enhancedConfig.list.advancedSearchFields) {
        const advancedConditions: any[] = []
        
        enhancedConfig.list.advancedSearchFields.forEach((searchField) => {
          if (searchField.type === 'text' || searchField.type === 'number') {
            const value = searchParams.get(`advanced_${searchField.field}`)
            if (value) {
              if (searchField.type === 'text') {
                advancedConditions.push({
                  [searchField.field]: { contains: value, mode: 'insensitive' as const }
                })
              } else {
                advancedConditions.push({
                  [searchField.field]: Number(value)
                })
              }
            }
          } else if (searchField.type === 'date' || searchField.type === 'datetime') {
            const value = searchParams.get(`advanced_${searchField.field}`)
            if (value) {
              advancedConditions.push({
                [searchField.field]: new Date(value)
              })
            }
          } else if (searchField.type === 'select') {
            const value = searchParams.get(`advanced_${searchField.field}`)
            // 忽略 "__all__" 值（表示清除条件）
            if (value && value !== '__all__') {
              advancedConditions.push({
                [searchField.field]: value
              })
            }
          } else if (searchField.type === 'dateRange') {
            const dateFrom = searchParams.get(`advanced_${searchField.field}_from`)
            const dateTo = searchParams.get(`advanced_${searchField.field}_to`)
            if (dateFrom || dateTo) {
              const dateCondition: any = {}
              if (dateFrom) {
                dateCondition.gte = new Date(dateFrom)
              }
              if (dateTo) {
                const endDate = new Date(dateTo)
                endDate.setHours(23, 59, 59, 999)
                dateCondition.lte = endDate
              }
              if (searchField.dateFields && searchField.dateFields.length > 0) {
                searchField.dateFields.forEach((dateField) => {
                  advancedConditions.push({ [dateField]: dateCondition })
                })
              } else {
                advancedConditions.push({ [searchField.field]: dateCondition })
              }
            }
          } else if (searchField.type === 'numberRange') {
            const numMin = searchParams.get(`advanced_${searchField.field}_min`)
            const numMax = searchParams.get(`advanced_${searchField.field}_max`)
            if (numMin || numMax) {
              const numCondition: any = {}
              if (numMin) {
                numCondition.gte = Number(numMin)
              }
              if (numMax) {
                numCondition.lte = Number(numMax)
              }
              if (searchField.numberFields && searchField.numberFields.length > 0) {
                searchField.numberFields.forEach((numField) => {
                  advancedConditions.push({ [numField]: numCondition })
                })
              } else {
                advancedConditions.push({ [searchField.field]: numCondition })
              }
            }
          }
        })
        
        // 根据逻辑组合高级搜索条件
        if (advancedConditions.length > 0) {
          if (advancedLogic === 'OR') {
            // OR 逻辑：与现有的 where.OR 合并
            if (where.OR) {
              where.OR = [...where.OR, ...advancedConditions]
            } else {
              where.OR = advancedConditions
            }
          } else {
            // AND 逻辑：所有条件都必须满足
            if (advancedConditions.length === 1) {
              Object.assign(where, advancedConditions[0])
            } else {
              where.AND = advancedConditions
            }
          }
        }
      }

      // 状态筛选通过快速筛选处理，这里只处理特殊的归档逻辑
      if (!parseIncludeArchived(searchParams) && enhancedConfig.prisma?.model === 'orders') {
        // 订单主表：默认排除完成留档、已取消（与关联表 includeArchived 语义一致；勾选历史后可见）
        const statusFilterValue = searchParams.get('filter_status')
        if (!statusFilterValue || statusFilterValue === '__all__') {
          where.status = {
            notIn: [...ORDER_STATUSES_EXCLUDED_FROM_OPERATIONAL_LISTS],
          }
        }
      }

      // 直送账单等：默认不列出关联订单已取消的发票（与业务「取消不出账」一致）
      if (
        enhancedConfig.prisma?.model === 'invoices' &&
        enhancedConfig.list.excludeCancelledOrders
      ) {
        const fragment = ordersWhereRootExcludeCancelledOnly()
        if (where.orders) {
          where.orders = { AND: [fragment, where.orders] }
        } else {
          where.orders = fragment
        }
      }

      // 查询数据
      const prismaModel = getPrismaModel(enhancedConfig)

      // 验证排序字段是否有效（检查字段是否存在且可排序）
      const sortFieldConfig = enhancedConfig.fields[sort]
      if (!sortFieldConfig || sortFieldConfig.hidden) {
        // 如果排序字段无效或已隐藏，使用默认排序
        console.warn(`[createListHandler] 无效的排序字段: ${sort}，使用默认排序: ${enhancedConfig.list.defaultSort}`)
        const defaultSort = enhancedConfig.list.defaultSort || 'id'
        const defaultOrder = enhancedConfig.list.defaultOrder || 'desc'
        sort = defaultSort
        order = defaultOrder
      }

      // 如果使用 include，需要确保排序字段是主表的字段，不是关系字段
      // 如果排序字段是关系字段，需要调整排序逻辑
      let orderByField = sort
      if (enhancedConfig.prisma?.include && sortFieldConfig?.type === 'relation') {
        // 如果排序字段是关系字段，且使用了 include，不能直接排序
        // 使用默认排序字段
        console.warn(`[createListHandler] 关系字段不能用于排序（使用 include 时），使用默认排序: ${enhancedConfig.list.defaultSort}`)
        orderByField = enhancedConfig.list.defaultSort || 'id'
      }

      // 如果使用 select，需要确保排序字段在 select 中
      if (enhancedConfig.prisma?.select) {
        const selectFields = Object.keys(enhancedConfig.prisma.select).filter(key => key !== 'departments_users_department_idTodepartments')
        if (!selectFields.includes(orderByField)) {
          // 如果排序字段不在 select 中，使用默认排序字段
          console.warn(`[createListHandler] 排序字段 ${orderByField} 不在 select 中，使用默认排序: ${enhancedConfig.list.defaultSort}`)
          orderByField = enhancedConfig.list.defaultSort || 'id'
          // 确保默认排序字段在 select 中
          if (!selectFields.includes(orderByField) && orderByField !== 'id') {
            // 如果默认排序字段也不在 select 中，使用 id
            orderByField = 'id'
          }
        }
      }

      const queryOptions: any = {
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy:
          enhancedConfig.prisma?.model === 'receivables' &&
          orderByField === 'invoice_date'
            ? [
                { invoices: { invoice_date: order } },
                { receivable_id: order === 'desc' ? 'desc' : 'asc' },
              ]
            : { [orderByField]: order },
      }

      // 添加 include 或 select
      if (enhancedConfig.prisma?.include) {
        queryOptions.include = enhancedConfig.prisma.include
      } else if (enhancedConfig.prisma?.select) {
        queryOptions.select = enhancedConfig.prisma.select
      }

      // 添加详细的查询日志（开发环境）
      if (process.env.NODE_ENV === 'development') {
        console.log('[createListHandler] 查询配置:', {
          model: enhancedConfig.prisma?.model || enhancedConfig.name,
          where: Object.keys(where),
          hasInclude: !!queryOptions.include,
          hasSelect: !!queryOptions.select,
          skip: queryOptions.skip,
          take: queryOptions.take,
          orderBy: queryOptions.orderBy,
        })
      }

      // 清理 where 条件：移除空的 OR 数组
      if (where.OR && Array.isArray(where.OR) && where.OR.length === 0) {
        delete where.OR
      }
      // 清理 where 条件：移除空的 AND 数组
      if (where.AND && Array.isArray(where.AND) && where.AND.length === 0) {
        delete where.AND
      }

      let items: any[] = []
      let total = 0
      let querySucceeded = false
      
      try {
        // 开发环境：记录查询选项
        if (process.env.NODE_ENV === 'development') {
          console.log('[createListHandler] 执行查询:', {
            model: enhancedConfig.prisma?.model || enhancedConfig.name,
            whereKeys: Object.keys(where),
            whereOR: where.OR,
            whereAND: where.AND,
            orderBy: queryOptions.orderBy,
            hasInclude: !!queryOptions.include,
            hasSelect: !!queryOptions.select,
            skip: queryOptions.skip,
            take: queryOptions.take,
          })
        }
        
        [items, total] = await Promise.all([
          prismaModel.findMany(queryOptions),
          prismaModel.count({ where }),
        ])
        querySucceeded = true
        
        // 如果是 orders 模型，需要处理 location 字段（delivery_location 和 port_location）
        // 如果这些字段存储的是 location_id（数字字符串），需要查询 locations 表获取 location_code
        if (enhancedConfig.prisma?.model === 'orders' && items.length > 0) {
          // 收集所有可能的 location_id（从 delivery_location 和 port_location）
          const locationIds = new Set<bigint>()
          items.forEach((item: any) => {
            if (item.delivery_location) {
              const deliveryLocationValue = String(item.delivery_location).trim()
              if (/^\d+$/.test(deliveryLocationValue)) {
                try {
                  locationIds.add(BigInt(deliveryLocationValue))
                } catch (e) {
                  // 忽略无效的 BigInt
                }
              }
            }
            if (item.port_location) {
              const portLocationValue = String(item.port_location).trim()
              if (/^\d+$/.test(portLocationValue)) {
                try {
                  locationIds.add(BigInt(portLocationValue))
                } catch (e) {
                  // 忽略无效的 BigInt
                }
              }
            }
          })
          
          // 批量查询 locations 表获取 location_code
          if (locationIds.size > 0) {
            const locations = await prisma.locations.findMany({
              where: {
                location_id: { in: Array.from(locationIds) },
              },
              select: {
                location_id: true,
                location_code: true,
              },
            })
            
            // 创建 location_id -> location_code 的映射
            const locationCodeMap = new Map<string, string>()
            locations.forEach((loc: any) => {
              locationCodeMap.set(String(loc.location_id), loc.location_code || '')
            })
            
            // 更新 items 中的 delivery_location 和 port_location 为 location_code
            items.forEach((item: any) => {
              if (item.delivery_location) {
                const deliveryLocationValue = String(item.delivery_location).trim()
                if (/^\d+$/.test(deliveryLocationValue)) {
                  const locationCode = locationCodeMap.get(deliveryLocationValue)
                  if (locationCode) {
                    item.delivery_location = locationCode
                  }
                }
              }
              if (item.port_location) {
                const portLocationValue = String(item.port_location).trim()
                if (/^\d+$/.test(portLocationValue)) {
                  const locationCode = locationCodeMap.get(portLocationValue)
                  if (locationCode) {
                    item.port_location = locationCode
                  }
                }
              }
            })
          }
        }
      } catch (queryError: any) {
        console.error('[createListHandler] Prisma 查询错误:', queryError)
        console.error('错误详情:', {
          message: queryError?.message,
          code: queryError?.code,
          meta: queryError?.meta,
          stack: queryError?.stack,
        })
        console.error('查询配置:', {
          model: enhancedConfig.prisma?.model || enhancedConfig.name,
          whereKeys: Object.keys(where),
          hasInclude: !!queryOptions.include,
          hasSelect: !!queryOptions.select,
        })
        
        // 如果是 "cached plan must not change result type" 错误，尝试强制重新规划查询
        if (queryError?.message?.includes('cached plan must not change result type')) {
          console.warn('[createListHandler] 检测到 PostgreSQL 缓存计划错误，尝试强制重新规划查询...')
          try {
            // 方法1: 在查询中添加一个时间戳参数来强制重新规划
            // 通过修改 where 条件添加一个不影响结果的参数
            const modifiedWhere = { ...where }
            // 添加一个始终为 true 的条件来强制重新规划
            if (!modifiedWhere.AND) {
              modifiedWhere.AND = []
            }
            // 使用一个不影响结果的 id 条件（id >= 0，所有记录都满足）
            const idField = enhancedConfig.idField || 'id'
            modifiedWhere.AND.push({
              [idField]: { gte: 0 }
            })
            
            const modifiedQueryOptions = {
              ...queryOptions,
              where: modifiedWhere
            }
            
            // 等待一小段时间
            await new Promise(resolve => setTimeout(resolve, 300))
            
            // 重试查询（使用修改后的查询选项）
            const retryResult = await Promise.all([
              prismaModel.findMany(modifiedQueryOptions),
              prismaModel.count({ where: modifiedWhere }),
            ])
            items = retryResult[0]
            total = retryResult[1]
            querySucceeded = true
            console.log('[createListHandler] 强制重新规划后重试成功')
            // 如果重试成功，继续执行后续逻辑
          } catch (retryError: any) {
            console.error('[createListHandler] 强制重新规划失败:', retryError)
            // 如果仍然失败，尝试断开并重新连接
            try {
              console.warn('[createListHandler] 尝试断开并重新连接...')
              await prisma.$disconnect()
              await new Promise(resolve => setTimeout(resolve, 1000))
              await prisma.$connect()
              // 再次重试（使用原始查询选项）
              await new Promise(resolve => setTimeout(resolve, 500))
              const retryResult2 = await Promise.all([
                prismaModel.findMany(queryOptions),
                prismaModel.count({ where }),
              ])
              items = retryResult2[0]
              total = retryResult2[1]
              querySucceeded = true
              console.log('[createListHandler] 重新连接后重试成功')
            } catch (retryError2: any) {
              console.error('[createListHandler] 重新连接后重试也失败:', retryError2)
              // 如果所有重试都失败，返回一个友好的错误消息
              console.warn('[createListHandler] 所有重试方法都失败，这可能是数据库服务器端的查询计划缓存问题。')
              console.warn('[createListHandler] 建议：等待几分钟让数据库连接池过期，或重启数据库服务。')
              querySucceeded = false
            }
          }
        }
        
        // 如果重试成功，跳过错误处理
        if (!querySucceeded) {
          // 如果是 Prisma 错误，返回更详细的错误信息
          if (queryError?.code) {
            return NextResponse.json(
              {
                error: `数据库查询失败: ${queryError.message || '未知错误'}`,
                details: process.env.NODE_ENV === 'development' ? {
                  code: queryError.code,
                  meta: queryError.meta,
                } : undefined,
              },
              { status: 500 }
            )
          }
          throw queryError
        }
      }

      // 数据转换（根据配置的 prisma 模型处理）
      const transformedItems = items.map((item: any, index: number) => {
        try {
          const serialized = serializeBigInt(item)
          
          // 开发环境：记录第一条数据的结构
          if (process.env.NODE_ENV === 'development' && index === 0) {
            console.log('[createListHandler] 第一条数据（转换前）:', {
              hasCustomers: !!serialized.customers,
              hasUsersOrdersUserIdTousers: !!serialized.users_orders_user_idTousers,
              hasCarriers: !!serialized.carriers,
              hasDepartmentsUsersDepartmentIdTodepartments: !!serialized.departments_users_department_idTodepartments,
              keys: Object.keys(serialized),
            })
          }
          // 处理订单数据：确保 order_id 是字符串，处理关联数据
          if (enhancedConfig.prisma?.model === 'orders') {
            if (serialized.order_id) {
              serialized.order_id = String(serialized.order_id)
            }
            // 处理 customers 关联：customers -> customer
            if (serialized.customers) {
              serialized.customer = serialized.customers
              delete serialized.customers
            } else {
              serialized.customer = null
            }
            // 处理 users_orders_user_idTousers 关联：users_orders_user_idTousers -> user_id (relation 字段)
            // 注意：保留原始的 user_id 值（BigInt），同时添加关联对象
            if (serialized.users_orders_user_idTousers) {
              serialized.user_id = serialized.users_orders_user_idTousers
              delete serialized.users_orders_user_idTousers
            } else if (serialized.user_id) {
              // 如果关联不存在但user_id存在，保留user_id值，但设置为null对象（前端会显示 '-'）
              serialized.user_id = null
            } else {
              // 如果user_id也不存在，设置为null
              serialized.user_id = null
            }
            // 处理 locations_orders_delivery_location_idTolocations 关联：-> delivery_location
            if (serialized.locations_orders_delivery_location_idTolocations) {
              serialized.delivery_location = serialized.locations_orders_delivery_location_idTolocations
              delete serialized.locations_orders_delivery_location_idTolocations
            } else if (serialized.delivery_location_id) {
              // 如果有ID但没有关联数据，设置为null（前端会显示'-'）
              serialized.delivery_location = null
            }
            // 处理 carriers 关联：carriers -> carrier
            if (serialized.carriers) {
              serialized.carrier = serialized.carriers
              delete serialized.carriers
            }
            // 计算整柜体积：从 order_detail 的 volume 总和得出
            // container_volume 已经在上面批量更新了，这里只需要设置显示值
            if (serialized.order_detail && Array.isArray(serialized.order_detail)) {
              const totalVolume = serialized.order_detail.reduce((sum: number, detail: any) => {
                // 确保 volume 是数字类型，处理 Decimal 类型和字符串
                let volume = 0
                if (detail.volume !== null && detail.volume !== undefined) {
                  if (typeof detail.volume === 'object' && 'toString' in detail.volume) {
                    // Decimal 类型
                    volume = parseFloat(detail.volume.toString()) || 0
                  } else if (typeof detail.volume === 'string') {
                    volume = parseFloat(detail.volume) || 0
                  } else {
                    volume = Number(detail.volume) || 0
                  }
                }
                return sum + volume
              }, 0)
              
              // 使用计算出的值（确保数据一致性）
              serialized.container_volume = totalVolume
            } else {
              // 如果没有明细，整柜体积为 0
              serialized.container_volume = 0
            }
          }
          // 处理用户数据：departments_users_department_idTodepartments -> department
          if (config.prisma?.model === 'users') {
            if (serialized.departments_users_department_idTodepartments) {
              serialized.department = serialized.departments_users_department_idTodepartments
              delete serialized.departments_users_department_idTodepartments
            } else {
              serialized.department = null
            }
            // 密码字段：不返回密码信息（安全考虑）
            if ('password_hash' in serialized) {
              delete serialized.password_hash
            }
            // password 字段显示为占位符（表示密码已设置）
            serialized.password = '******'
          }
          // 处理客户数据：contact_roles -> contact, credit_limit 转换
          if (config.prisma?.model === 'customers') {
            if (serialized.contact_roles) {
              serialized.contact = {
                name: serialized.contact_roles.name || '',
                phone: serialized.contact_roles.phone || null,
                email: serialized.contact_roles.email || null,
              }
              delete serialized.contact_roles
            } else {
              serialized.contact = null
            }
            if (serialized.credit_limit !== null && serialized.credit_limit !== undefined) {
              if (typeof serialized.credit_limit === 'object' && 'toString' in serialized.credit_limit) {
                serialized.credit_limit = serialized.credit_limit.toString()
              } else {
                serialized.credit_limit = String(serialized.credit_limit)
              }
              if (serialized.credit_limit === 'null' || serialized.credit_limit === 'undefined' || serialized.credit_limit === '') {
                serialized.credit_limit = null
              }
            } else {
              serialized.credit_limit = null
            }
          }
          // 处理仓库数据：locations -> location, users_warehouses_contact_user_idTousers -> contact_user
          if (config.prisma?.model === 'warehouses') {
            if (serialized.locations) {
              serialized.location = serialized.locations
              delete serialized.locations
            } else {
              serialized.location = null
            }
            if (serialized.users_warehouses_contact_user_idTousers) {
              serialized.contact_user = serialized.users_warehouses_contact_user_idTousers
              delete serialized.users_warehouses_contact_user_idTousers
            } else {
              serialized.contact_user = null
            }
          }
          // 处理部门数据：departments -> parent
          // 注意：manager_id 字段存在，但在 schema 中没有定义关系，保留 manager_id 供前端使用
          if (config.prisma?.model === 'departments') {
            if (serialized.departments) {
              serialized.parent = serialized.departments
              delete serialized.departments
            } else {
              serialized.parent = null
            }
            // manager_id 保留在数据中，前端可以通过 manager_id 单独查询
            serialized.manager = serialized.manager_id ? { id: serialized.manager_id } : null
          }
          // 处理承运商数据：contact_roles -> contact
          if (config.prisma?.model === 'carriers') {
            if (serialized.contact_roles) {
              serialized.contact = {
                name: serialized.contact_roles.name || '',
                phone: serialized.contact_roles.phone || null,
                email: serialized.contact_roles.email || null,
              }
              delete serialized.contact_roles
            } else {
              serialized.contact = null
            }
          }
          // 处理车辆数据：carriers -> carrier
          if (config.prisma?.model === 'vehicles') {
            if (serialized.carriers) {
              serialized.carrier = serialized.carriers
              delete serialized.carriers
            }
          }
          // 处理货柜数据：departments -> department
          if (config.prisma?.model === 'trailers') {
            if (serialized.departments) {
              serialized.department = serialized.departments
              delete serialized.departments
            }
          }
          // 处理司机数据：carriers -> carrier, contact_roles -> contact
          if (config.prisma?.model === 'drivers') {
            if (serialized.carriers) {
              serialized.carrier = serialized.carriers
              delete serialized.carriers
            }
            if (serialized.contact_roles) {
              serialized.contact = {
                name: serialized.contact_roles.name || '',
                phone: serialized.contact_roles.phone || null,
                email: serialized.contact_roles.email || null,
              }
              delete serialized.contact_roles
            } else {
              serialized.contact = null
            }
          }
          if (enhancedConfig.prisma?.model === 'receivables' && serialized.invoices) {
            serialized.invoice_date = serialized.invoices.invoice_date ?? null
          }
          return serialized
        } catch (error: any) {
          console.error('数据转换错误:', error, 'item:', item)
          // 如果转换失败，返回序列化后的原始数据
          return serializeBigInt(item)
        }
      })

      const summary = await buildListSummary(
        prismaModel,
        where,
        enhancedConfig.list.listAggregates
      )

      return NextResponse.json({
        ...buildPaginationResponse(transformedItems, total, page, limit),
        summary,
      })
    } catch (error: any) {
      console.error(`[createListHandler] 获取${config.displayName}列表失败:`, error)
      console.error('错误详情:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
        code: error?.code,
        model: config.prisma?.model || config.name,
        configName: config.name,
      })
      // 如果是 Prisma 错误，提供更详细的错误信息
      if (error?.code) {
        console.error('Prisma 错误代码:', error.code)
        console.error('Prisma 错误元数据:', error.meta)
      }
      return handleError(error, `获取${config.displayName}列表失败`)
    }
  }
}

/**
 * 创建通用 GET 详情处理函数
 */
export function createDetailHandler(config: EntityConfig) {
  return async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const permissionResult = await checkEntityPermission(
        config.permissions.list,
        config
      )
      if (permissionResult.error) return permissionResult.error

      const resolvedParams = await params
      const prismaModel = getPrismaModel(config)

      // 获取主键字段名（默认为 'id'）
      const idField = config.idField || 'id'
      const queryOptions: any = {
        where: { [idField]: BigInt(resolvedParams.id) },
      }

      if (config.prisma?.include) {
        queryOptions.include = config.prisma.include
      } else if (config.prisma?.select) {
        queryOptions.select = config.prisma.select
      }

      const item = await prismaModel.findUnique(queryOptions)

      if (!item) {
        return NextResponse.json(
          { error: `${config.displayName}不存在` },
          { status: 404 }
        )
      }

      const serialized = serializeBigInt(item)
      // 数据转换（与列表转换逻辑相同）
      let transformed = serialized
      
      // 处理部门数据：departments -> parent
      // 注意：manager_id 字段存在，但在 schema 中没有定义关系
      if (config.prisma?.model === 'departments') {
        if (transformed.departments) {
          transformed.parent = transformed.departments
          delete transformed.departments
        } else {
          transformed.parent = null
        }
        // manager_id 保留在数据中，前端可以通过 manager_id 单独查询
        transformed.manager = transformed.manager_id ? { id: transformed.manager_id } : null
      }
      
      // 处理用户数据：departments_users_department_idTodepartments -> department
      if (config.prisma?.model === 'users') {
        if (transformed.departments_users_department_idTodepartments) {
          transformed.department = transformed.departments_users_department_idTodepartments
          delete transformed.departments_users_department_idTodepartments
        } else {
          transformed.department = null
        }
      }
      
      // 处理客户数据：contact_roles -> contact
      if (config.prisma?.model === 'customers') {
        if (transformed.contact_roles) {
          transformed.contact = {
            name: transformed.contact_roles.name || '',
            phone: transformed.contact_roles.phone || null,
            email: transformed.contact_roles.email || null,
          }
          delete transformed.contact_roles
        } else {
          transformed.contact = null
        }
      }
      
      // 处理订单数据：计算整柜体积
      if (config.prisma?.model === 'orders') {
        if (transformed.order_id) {
          transformed.order_id = String(transformed.order_id)
        }
        // 处理 customers 关联：customers -> customer
        if (transformed.customers) {
          transformed.customer = transformed.customers
          delete transformed.customers
        } else {
          transformed.customer = null
        }
        // 处理 users_orders_user_idTousers 关联：users_orders_user_idTousers -> user_id
        if (transformed.users_orders_user_idTousers) {
          transformed.user_id = transformed.users_orders_user_idTousers
          delete transformed.users_orders_user_idTousers
        } else {
          transformed.user_id = null
        }
        // 处理 carriers 关联：carriers -> carrier
        if (transformed.carriers) {
          transformed.carrier = transformed.carriers
          delete transformed.carriers
        }
        // 计算整柜体积：从 order_detail 的 volume 总和得出，并更新数据库
        // 如果数据库中的 container_volume 与计算值不一致，则更新数据库
        if (transformed.order_detail && Array.isArray(transformed.order_detail)) {
          const totalVolume = transformed.order_detail.reduce((sum: number, detail: any) => {
            // 确保 volume 是数字类型，处理 Decimal 类型和字符串
            let volume = 0
            if (detail.volume !== null && detail.volume !== undefined) {
              if (typeof detail.volume === 'object' && 'toString' in detail.volume) {
                // Decimal 类型
                volume = parseFloat(detail.volume.toString()) || 0
              } else if (typeof detail.volume === 'string') {
                volume = parseFloat(detail.volume) || 0
              } else {
                volume = Number(detail.volume) || 0
              }
            }
            return sum + volume
          }, 0)
          
          // 使用计算出的值（确保数据一致性）
          transformed.container_volume = totalVolume
          
          // 如果数据库中的值与计算值不一致，异步更新数据库（不阻塞响应）
          const dbContainerVolume = transformed.container_volume ? Number(transformed.container_volume) : 0
          if (Math.abs(dbContainerVolume - totalVolume) > 0.01) {
            prisma.orders.update({
              where: { order_id: BigInt(transformed.order_id) },
              data: { container_volume: totalVolume },
            }).catch((updateError: any) => {
              console.error(`[createDetailHandler] 更新订单 ${transformed.order_id} container_volume 失败:`, updateError)
            })
          }
        } else {
          // 如果没有明细，整柜体积为 0
          transformed.container_volume = 0
          // 如果数据库中的值不是 0，异步更新数据库（不阻塞响应）
          const dbContainerVolume = transformed.container_volume ? Number(transformed.container_volume) : 0
          if (dbContainerVolume !== 0) {
            prisma.orders.update({
              where: { order_id: BigInt(transformed.order_id) },
              data: { container_volume: 0 },
            }).catch((updateError: any) => {
              console.error(`[createDetailHandler] 更新订单 ${transformed.order_id} container_volume 失败:`, updateError)
            })
          }
        }
      }
      
      // 处理仓库数据：locations -> location, users_warehouses_contact_user_idTousers -> contact_user
      if (config.prisma?.model === 'warehouses') {
        if (transformed.locations) {
          transformed.location = transformed.locations
          delete transformed.locations
        } else {
          transformed.location = null
        }
        if (transformed.users_warehouses_contact_user_idTousers) {
          transformed.contact_user = transformed.users_warehouses_contact_user_idTousers
          delete transformed.users_warehouses_contact_user_idTousers
        } else {
          transformed.contact_user = null
        }
      }
      
      // 处理承运商数据：contact_roles -> contact
      if (config.prisma?.model === 'carriers') {
        if (transformed.contact_roles) {
          transformed.contact = {
            name: transformed.contact_roles.name || '',
            phone: transformed.contact_roles.phone || null,
            email: transformed.contact_roles.email || null,
          }
          delete transformed.contact_roles
        } else {
          transformed.contact = null
        }
      }
      
      // 处理车辆数据：carriers -> carrier
      if (config.prisma?.model === 'vehicles') {
        if (transformed.carriers) {
          transformed.carrier = transformed.carriers
          delete transformed.carriers
        }
      }
      
      // 处理货柜数据：departments -> department
      if (config.prisma?.model === 'trailers') {
        if (transformed.departments) {
          transformed.department = transformed.departments
          delete transformed.departments
        }
      }
      
      // 处理司机数据：carriers -> carrier, contact_roles -> contact
      if (config.prisma?.model === 'drivers') {
        if (transformed.carriers) {
          transformed.carrier = transformed.carriers
          delete transformed.carriers
        }
        if (transformed.contact_roles) {
          transformed.contact = {
            name: transformed.contact_roles.name || '',
            phone: transformed.contact_roles.phone || null,
            email: transformed.contact_roles.email || null,
          }
          delete transformed.contact_roles
        } else {
          transformed.contact = null
        }
      }

      if (config.prisma?.model === 'receivables' && transformed.invoices) {
        transformed.invoice_date = transformed.invoices.invoice_date ?? null
      }

      return NextResponse.json({ data: transformed })
    } catch (error) {
      return handleError(error, `获取${config.displayName}详情失败`)
    }
  }
}

/**
 * 创建通用 POST 创建处理函数
 */
export function createCreateHandler(config: EntityConfig) {
  return async (request: NextRequest) => {
    try {
      const permissionResult = await checkEntityPermission(
        config.permissions.create,
        config
      )
      if (permissionResult.error) return permissionResult.error

      const body = await request.json()
      const createSchema = getSchema(config.schemaName, 'create')
      const validationResult = createSchema.safeParse(body)
      
      if (!validationResult.success) {
        return handleValidationError(validationResult.error)
      }

      const data = validationResult.data
      const submitData = data // 提交数据转换在需要时处理

      // 处理 BigInt 字段和日期字段
      const processedData: any = {}
      for (const [key, value] of Object.entries(submitData as Record<string, any>)) {
        if (
          config.prisma?.model === 'receivables' &&
          ['allocated_amount', 'balance', 'status'].includes(key)
        ) {
          continue
        }
        const fieldConfig = config.fields[key]
        // 跳过只读/计算字段（如 container_volume）
        if (fieldConfig?.readonly || fieldConfig?.computed) {
          continue
        }
        if (fieldConfig?.type === 'boolean') {
          if (value !== undefined && value !== null) {
            processedData[key] = Boolean(value)
          }
          continue
        }
        if (fieldConfig?.relation && fieldConfig.relation.valueField) {
          if (value !== undefined && value !== null && value !== '') {
            const targetField = key.endsWith('_id') ? key : fieldConfig.relation.valueField
            const idStr = typeof value === 'bigint' ? value.toString() : String(value).trim()
            if (/^\d+$/.test(idStr)) {
              processedData[targetField] = BigInt(idStr)
            }
          }
        } else if (key.endsWith('_id') && value !== undefined && value !== null && value !== '') {
          const idStr = typeof value === 'bigint' ? value.toString() : String(value).trim()
          if (/^\d+$/.test(idStr)) {
            processedData[key] = BigInt(idStr)
          }
        } else if (value && typeof value === 'string' && (fieldConfig?.type === 'date' || fieldConfig?.type === 'datetime' || key.includes('_date') || key.includes('_at'))) {
          // 处理日期字段：如果是 YYYY-MM-DD 格式，转换为完整的 DateTime
          // Prisma 需要完整的 ISO-8601 DateTime 格式（包含时间部分）
          if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            // YYYY-MM-DD 格式，添加时间部分（00:00:00.000Z）
            processedData[key] = new Date(value + 'T00:00:00.000Z')
          } else if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
            // 已经是完整的 DateTime 格式（包含 T），直接转换
            processedData[key] = new Date(value)
          } else {
            // 其他格式，尝试转换
            processedData[key] = new Date(value)
          }
        } else {
          processedData[key] = value
        }
      }

      // 对于订单表，创建时设置 container_volume = 0（新建订单时没有明细，体积为 0）
      if (config.prisma?.model === 'orders') {
        processedData.container_volume = 0
        if (hasPickupDateValue(processedData.pickup_date)) {
          processedData.pickup_date_entered_at = new Date()
        }
        await applyOrderFistFromCustomerOnWrite(processedData, { isCreate: true })
      }

      // 对于应收表：已核销/余额/状态仅由收款核销与发票同步计算，创建时默认 allocated=0 并推导 balance、status
      if (config.prisma?.model === 'receivables' && processedData.receivable_amount != null) {
        const { deriveReceivableBalanceAndStatus } = await import('@/lib/finance/invoice-receivable-sync')
        processedData.allocated_amount = processedData.allocated_amount ?? 0
        const { balance, status } = deriveReceivableBalanceAndStatus(
          processedData.receivable_amount,
          processedData.allocated_amount
        )
        processedData.balance = balance
        processedData.status = status
      }

      if (config.prisma?.model === 'receivables' && processedData.invoice_id) {
        const inv = await prisma.invoices.findUnique({
          where: { invoice_id: processedData.invoice_id },
          select: { invoice_date: true },
        })
        if (inv?.invoice_date) {
          const { dueDateOneMonthAfterInvoiceDate } = await import(
            '@/lib/finance/invoice-receivable-sync'
          )
          processedData.due_date = dueDateOneMonthAfterInvoiceDate(inv.invoice_date)
        }
      }

      if (config.prisma?.model === 'payments') {
        processedData.currency = processedData.currency || 'USD'
        processedData.payment_method = null
        const amount = Number(processedData.amount ?? 0)
        processedData.write_off = shouldPaymentWriteOff(amount, 0)
      }

      // 账单总金额由明细汇总，创建时主表 total_amount 仅允许默认 0（表单已不提交该字段）
      if (config.prisma?.model === 'invoices' && processedData.total_amount === undefined) {
        processedData.total_amount = 0
      }

      // 自动添加系统维护字段（创建人/时间、修改人/时间）
      const { addSystemFields } = await import('@/lib/api/helpers')
      addSystemFields(processedData, permissionResult.user, true)

      const prismaModel = getPrismaModel(config)
      const item = await prismaModel.create({
        data: processedData,
      })

      // 对于订单表，如果创建时操作方式就是"拆柜"（unload），自动创建入库记录（已取消订单不建下游业务表）
      if (
        config.prisma?.model === 'orders' &&
        processedData.operation_mode === 'unload' &&
        item.status !== ORDER_STATUS_CANCELLED
      ) {
        try {
          // 获取第一个可用的 warehouse_id，如果没有则使用 1000 作为默认值
          const firstWarehouse = await prisma.warehouses.findFirst({
            select: { warehouse_id: true },
            orderBy: { warehouse_id: 'asc' },
          })
          
          const warehouseId = firstWarehouse?.warehouse_id || BigInt(1000)
          
          // 检查是否已存在入库记录（理论上不应该存在，因为刚创建）
          const existingInboundReceipt = await prisma.inbound_receipt.findUnique({
            where: { order_id: item.order_id },
            select: { inbound_receipt_id: true },
          })
          
          // 如果不存在，则创建入库记录
          if (!existingInboundReceipt) {
            // 获取订单的 pickup_date 和 eta_date 用于计算拆柜日期
            const orderForCalculation = await prisma.orders.findUnique({
              where: { order_id: item.order_id },
              select: {
                pickup_date: true,
                eta_date: true,
              },
            })
            
            // 计算拆柜日期
            const calculatedUnloadDate = orderForCalculation
              ? calculateUnloadDate(orderForCalculation.pickup_date, orderForCalculation.eta_date)
              : null
            
            await prisma.inbound_receipt.create({
              data: {
                order_id: item.order_id,
                warehouse_id: warehouseId,
                status: 'pending',
                planned_unload_at: calculatedUnloadDate,
                created_by: permissionResult.user?.id ? BigInt(permissionResult.user.id) : null,
                updated_by: permissionResult.user?.id ? BigInt(permissionResult.user.id) : null,
              },
            })
          }
        } catch (inboundError: any) {
          // 如果创建失败（例如已存在），记录错误但不影响订单创建
          console.warn('自动创建入库记录失败:', inboundError)
        }
      }

      // 对于订单表，自动创建提柜管理记录（已取消订单不参与提柜等业务）
      if (config.prisma?.model === 'orders' && item.status !== ORDER_STATUS_CANCELLED) {
        try {
          // 检查是否已存在提柜管理记录（理论上不应该存在，因为刚创建）
          const existingPickup = await prisma.pickup_management.findUnique({
            where: { order_id: item.order_id },
            select: { pickup_id: true },
          })
          
          // 如果不存在，则创建提柜管理记录
          if (!existingPickup) {
            await prisma.pickup_management.create({
              data: {
                order_id: item.order_id,
                created_by: permissionResult.user?.id ? BigInt(permissionResult.user.id) : null,
                updated_by: permissionResult.user?.id ? BigInt(permissionResult.user.id) : null,
              },
            })
          }
        } catch (pickupError: any) {
          // 如果创建失败（例如已存在），记录错误但不影响订单创建
          console.warn('自动创建提柜管理记录失败:', pickupError)
        }
      }

      // 发票：创建即为「已审核」时同步到应收
      if (config.prisma?.model === 'invoices' && item.status === 'audited') {
        const userId = permissionResult.user?.id ? BigInt(permissionResult.user.id) : null
        const { upsertReceivableForAuditedInvoice } = await import(
          '@/lib/finance/invoice-receivable-sync'
        )
        await upsertReceivableForAuditedInvoice(prisma, item.invoice_id, userId)
      }

      return NextResponse.json(
        { data: serializeBigInt(item) },
        { status: 201 }
      )
    } catch (error: any) {
      // 处理唯一性约束错误
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: `${config.displayName}代码已存在` },
          { status: 409 }
        )
      }
      return handleError(error, `创建${config.displayName}失败`)
    }
  }
}

/**
 * 创建通用 PUT 更新处理函数
 */
export function createUpdateHandler(config: EntityConfig) {
  return async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const permissionResult = await checkEntityPermission(
        config.permissions.update,
        config
      )
      if (permissionResult.error) return permissionResult.error

      const resolvedParams = await params
      const body = await request.json()
      const updateSchema = getSchema(config.schemaName, 'update')
      const validationResult = updateSchema.safeParse(body)
      
      if (!validationResult.success) {
        return handleValidationError(validationResult.error)
      }

      const data = validationResult.data
      const submitData = data // 提交数据转换在需要时处理

      // 获取主键字段名（默认为 'id'）
      const idField = config.idField || 'id'

      // 处理 BigInt 字段、boolean 字段和日期字段
      const processedData: any = {}
      for (const [key, value] of Object.entries(submitData as Record<string, any>)) {
        if (
          config.prisma?.model === 'receivables' &&
          ['allocated_amount', 'balance', 'status'].includes(key)
        ) {
          continue
        }
        const fieldConfig = config.fields[key]
        if (fieldConfig?.readonly || fieldConfig?.computed) {
          continue
        }

        // 处理 boolean 字段：确保转换为布尔类型
        if (fieldConfig?.type === 'boolean') {
          if (value !== undefined && value !== null) {
            processedData[key] = Boolean(value)
          }
          continue // 跳过后续处理
        }
        
        // 处理日期字段：将字符串转换为 Date 对象
        if (fieldConfig?.type === 'date' && typeof value === 'string' && value) {
          // 日期字符串格式：YYYY-MM-DD，转换为 Date 对象（UTC）
          const [year, month, day] = value.split('-').map(Number)
          if (year && month && day) {
            processedData[key] = new Date(Date.UTC(year, month - 1, day))
          } else {
            processedData[key] = value
          }
          continue
        }
        
        // 处理日期时间字段：将字符串转换为 Date 对象
        if (fieldConfig?.type === 'datetime' && typeof value === 'string' && value) {
          // 日期时间字符串，手动解析为 Date（不进行时区转换）
          // 格式：YYYY-MM-DDTHH:mm 或 YYYY-MM-DDTHH:mm:ss
          const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{3}))?/)
          if (match) {
            const [, year, month, day, hours, minutes, seconds = '0', milliseconds = '0'] = match
            // 使用 UTC 方法创建 Date 对象，这样就不会进行时区转换
            processedData[key] = new Date(Date.UTC(
              parseInt(year, 10),
              parseInt(month, 10) - 1,
              parseInt(day, 10),
              parseInt(hours, 10),
              parseInt(minutes, 10),
              parseInt(seconds, 10),
              parseInt(milliseconds, 10)
            ))
          } else {
            // 如果不是预期格式，尝试直接解析（可能会进行时区转换，但这是后备方案）
            processedData[key] = new Date(value)
          }
          continue
        }
        
        if (fieldConfig?.relation) {
          const targetField =
            fieldConfig.relationField ||
            (key.endsWith('_id') ? key : `${key}_id`)
          // 显式清空可选外键（如费用 customer_id）
          if (value === null || value === '') {
            processedData[targetField] = null
          } else if (value !== undefined) {
            const idStr = typeof value === 'bigint' ? value.toString() : String(value).trim()
            if (/^\d+$/.test(idStr)) {
              processedData[targetField] = BigInt(idStr)
            }
          }
        } else if (key.endsWith('_id') && value !== undefined && value !== null && value !== '') {
          const idStr = typeof value === 'bigint' ? value.toString() : String(value).trim()
          if (/^\d+$/.test(idStr)) {
            processedData[key] = BigInt(idStr)
          }
        } else {
          processedData[key] = value
        }
      }

      // 自动添加系统维护字段（只更新修改人/时间）
      const { addSystemFields } = await import('@/lib/api/helpers')
      addSystemFields(processedData, permissionResult.user, false)

      if (config.prisma?.model === 'payments') {
        processedData.payment_method = null
        if (processedData.currency !== undefined) {
          processedData.currency = processedData.currency || 'USD'
        }
        const existingPayment = await prisma.payments.findUnique({
          where: { payment_id: BigInt(resolvedParams.id) },
          select: { amount: true },
        })
        if (!existingPayment) {
          return NextResponse.json({ error: `${config.displayName}不存在` }, { status: 404 })
        }
        const sumAgg = await prisma.payment_allocations.aggregate({
          where: { payment_id: BigInt(resolvedParams.id) },
          _sum: { allocated_amount: true },
        })
        const allocatedTotal = Number(sumAgg._sum.allocated_amount ?? 0)
        const effectiveAmount = Number(
          processedData.amount !== undefined ? processedData.amount : existingPayment.amount
        )
        processedData.write_off = shouldPaymentWriteOff(effectiveAmount, allocatedTotal)
      }

      const prismaModel = getPrismaModel(config)
      
      // 对于订单表，检查 operation_mode 是否变为"拆柜"（unload），如果是则自动创建入库记录（已取消不参与）
      if (config.prisma?.model === 'orders' && processedData.operation_mode === 'unload') {
        // 先获取当前订单，检查旧操作方式和是否已经有入库记录
        const currentOrder = await prismaModel.findUnique({
          where: { [idField]: BigInt(resolvedParams.id) },
          select: { order_id: true, operation_mode: true, status: true },
        })
        const effectiveStatus =
          processedData.status !== undefined ? processedData.status : currentOrder?.status
        if (effectiveStatus === ORDER_STATUS_CANCELLED) {
          // 本单将保持/变为已取消，不创建入库等业务数据
        } else if (currentOrder && currentOrder.operation_mode !== 'unload') {
          // 只有当操作方式从非"拆柜"变为"拆柜"时才创建入库记录
          // 检查是否已存在入库记录
          const existingInboundReceipt = await prisma.inbound_receipt.findUnique({
            where: { order_id: currentOrder.order_id },
            select: { inbound_receipt_id: true },
          })
          
          // 如果不存在，则创建入库记录
          if (!existingInboundReceipt) {
            try {
              // 获取第一个可用的 warehouse_id，如果没有则使用 1000 作为默认值
              const firstWarehouse = await prisma.warehouses.findFirst({
                select: { warehouse_id: true },
                orderBy: { warehouse_id: 'asc' },
              })
              
              const warehouseId = firstWarehouse?.warehouse_id || BigInt(1000)
              
              // 获取订单的 pickup_date 和 eta_date 用于计算拆柜日期
              const orderForCalculation = await prisma.orders.findUnique({
                where: { order_id: currentOrder.order_id },
                select: {
                  pickup_date: true,
                  eta_date: true,
                },
              })
              
              // 计算拆柜日期
              const calculatedUnloadDate = orderForCalculation
                ? calculateUnloadDate(orderForCalculation.pickup_date, orderForCalculation.eta_date)
                : null

              await prisma.inbound_receipt.create({
                data: {
                  order_id: currentOrder.order_id,
                  warehouse_id: warehouseId,
                  status: 'pending',
                  planned_unload_at: calculatedUnloadDate,
                  created_by: permissionResult.user?.id ? BigInt(permissionResult.user.id) : null,
                  updated_by: permissionResult.user?.id ? BigInt(permissionResult.user.id) : null,
                },
              })
            } catch (inboundError: any) {
              // 如果创建失败（例如已存在），记录错误但不影响订单更新
              console.warn('自动创建入库记录失败:', inboundError)
            }
          }
        } else if (currentOrder && currentOrder.operation_mode === 'unload') {
          // 如果订单已经是"拆柜"但还没有入库记录，也创建入库记录
          const existingInboundReceipt = await prisma.inbound_receipt.findUnique({
            where: { order_id: currentOrder.order_id },
            select: { inbound_receipt_id: true },
          })
          
          if (!existingInboundReceipt) {
            try {
              const firstWarehouse = await prisma.warehouses.findFirst({
                select: { warehouse_id: true },
                orderBy: { warehouse_id: 'asc' },
              })
              
              const warehouseId = firstWarehouse?.warehouse_id || BigInt(1000)
              
              // 获取订单的 pickup_date 和 eta_date 用于计算拆柜日期
              const orderForCalculation = await prisma.orders.findUnique({
                where: { order_id: currentOrder.order_id },
                select: {
                  pickup_date: true,
                  eta_date: true,
                },
              })
              
              // 计算拆柜日期
              const calculatedUnloadDate = orderForCalculation
                ? calculateUnloadDate(orderForCalculation.pickup_date, orderForCalculation.eta_date)
                : null

              await prisma.inbound_receipt.create({
                data: {
                  order_id: currentOrder.order_id,
                  warehouse_id: warehouseId,
                  status: 'pending',
                  planned_unload_at: calculatedUnloadDate,
                  created_by: permissionResult.user?.id ? BigInt(permissionResult.user.id) : null,
                  updated_by: permissionResult.user?.id ? BigInt(permissionResult.user.id) : null,
                },
              })
            } catch (inboundError: any) {
              console.warn('自动创建入库记录失败:', inboundError)
            }
          }
        }
      }
      
      let item: any
      let ordersBeforeUpdate: {
        status: string | null
        operation_mode: string | null
        pickup_date: Date | null
        pickup_date_entered_at: Date | null
        customer_id: bigint | null
      } | null = null
      if (config.prisma?.model === 'orders') {
        ordersBeforeUpdate = await prisma.orders.findUnique({
          where: { order_id: BigInt(resolvedParams.id) },
          select: {
            status: true,
            operation_mode: true,
            pickup_date: true,
            pickup_date_entered_at: true,
            customer_id: true,
          },
        })
        if (processedData.pickup_date !== undefined && ordersBeforeUpdate) {
          applyPickupDateEnteredAtToOrderUpdate(processedData, {
            previousPickup: ordersBeforeUpdate.pickup_date,
            existingEnteredAt: ordersBeforeUpdate.pickup_date_entered_at,
          })
        }
        await applyOrderFistFromCustomerOnWrite(processedData, {
          isCreate: false,
          existingCustomerId: ordersBeforeUpdate?.customer_id ?? null,
        })
        item = await prisma.$transaction(async (tx) => {
          const updated = await tx.orders.update({
            where: { order_id: BigInt(resolvedParams.id) },
            data: processedData,
          })
          if (
            updated.status === ORDER_STATUS_CANCELLED &&
            ordersBeforeUpdate?.status !== ORDER_STATUS_CANCELLED
          ) {
            await purgeOperationalDataForCancelledOrder(tx, updated.order_id)
          }
          return updated
        })

        // 操作方式变更：本单全部仍生效的预约统一停用（回退板数、删送仓/出库等），避免漏改
        if (
          ordersBeforeUpdate &&
          ordersBeforeUpdate.operation_mode !== item.operation_mode
        ) {
          try {
            const { cancelAllActiveAppointmentsForOrder } = await import(
              '@/lib/services/cancel-appointments-for-order'
            )
            const r = await cancelAllActiveAppointmentsForOrder(item.order_id)
            if (r.detailLinesRemoved > 0 || r.appointmentsFullyDisabled > 0) {
              console.log(
                `[订单更新] 操作方式 ${ordersBeforeUpdate.operation_mode ?? '(空)'} → ${item.operation_mode ?? '(空)'}：已移除本单 ${r.detailLinesRemoved} 条预约占用；${r.appointmentsFullyDisabled} 个预约因已无明细整单停用（拼柜他单明细仍保留的预约仅删本单行并回写板数）`
              )
            }
          } catch (appointmentsCancelErr: any) {
            console.warn('[订单更新] 操作方式变更后停用预约失败:', appointmentsCancelErr)
          }
        }
      } else if (config.prisma?.model === 'receivables') {
        const rid = BigInt(resolvedParams.id)
        const existing = await prismaModel.findUnique({
          where: { [idField]: rid },
          select: { receivable_amount: true, allocated_amount: true, invoice_id: true },
        })
        if (!existing) {
          return NextResponse.json({ error: `${config.displayName}不存在` }, { status: 404 })
        }
        const newRecAmt =
          processedData.receivable_amount !== undefined
            ? processedData.receivable_amount
            : existing.receivable_amount
        const { deriveReceivableBalanceAndStatus, dueDateOneMonthAfterInvoiceDate } =
          await import('@/lib/finance/invoice-receivable-sync')
        const { balance, status } = deriveReceivableBalanceAndStatus(
          newRecAmt,
          existing.allocated_amount ?? 0
        )
        processedData.balance = balance
        processedData.status = status

        const invoiceIdToUse = processedData.invoice_id ?? existing.invoice_id
        if (invoiceIdToUse) {
          const inv = await prisma.invoices.findUnique({
            where: { invoice_id: invoiceIdToUse },
            select: { invoice_date: true },
          })
          if (inv?.invoice_date) {
            processedData.due_date = dueDateOneMonthAfterInvoiceDate(inv.invoice_date)
          }
        }

        item = await prismaModel.update({
          where: { [idField]: rid },
          data: processedData,
        })
      } else if (config.prisma?.model === 'invoices') {
        const invoicePk = BigInt(resolvedParams.id)
        const beforeInvoice = await prismaModel.findUnique({
          where: { [idField]: invoicePk },
          select: { invoice_id: true, status: true },
        })
        const prevStatus = beforeInvoice?.status ?? null
        const effectiveNewStatus =
          processedData.status !== undefined ? processedData.status : prevStatus

        if (prevStatus === 'audited' && effectiveNewStatus !== 'audited') {
          const { getReceivableWithdrawBlockReason } = await import(
            '@/lib/finance/invoice-receivable-sync'
          )
          const block = await getReceivableWithdrawBlockReason(prisma, invoicePk)
          if (block) {
            return NextResponse.json({ error: block }, { status: 409 })
          }
        }

        item = await prismaModel.update({
          where: { [idField]: invoicePk },
          data: processedData,
        })

        const userId = permissionResult.user?.id ? BigInt(permissionResult.user.id) : null
        const { upsertReceivableForAuditedInvoice, withdrawReceivableForInvoice } =
          await import('@/lib/finance/invoice-receivable-sync')

        try {
          if (item.status === 'audited') {
            await upsertReceivableForAuditedInvoice(prisma, item.invoice_id, userId)
          } else if (prevStatus === 'audited' && item.status !== 'audited') {
            await withdrawReceivableForInvoice(prisma, item.invoice_id)
          }
        } catch (e: any) {
          if (e?.name === 'ReceivableWithdrawError') {
            return NextResponse.json({ error: e.message }, { status: 409 })
          }
          throw e
        }
      } else {
        item = await prismaModel.update({
          where: { [idField]: BigInt(resolvedParams.id) },
          data: processedData,
        })
      }

      // 对于订单表，确保提柜管理记录存在（如果不存在则创建）；已取消订单不创建
      if (config.prisma?.model === 'orders' && item.status !== ORDER_STATUS_CANCELLED) {
        try {
          const existingPickup = await prisma.pickup_management.findUnique({
            where: { order_id: item.order_id },
            select: { pickup_id: true },
          })
          
          // 如果不存在，则创建提柜管理记录
          if (!existingPickup) {
            await prisma.pickup_management.create({
              data: {
                order_id: item.order_id,
                created_by: permissionResult.user?.id ? BigInt(permissionResult.user.id) : null,
                updated_by: permissionResult.user?.id ? BigInt(permissionResult.user.id) : null,
              },
            })
          }
        } catch (pickupError: any) {
          // 如果创建失败（例如已存在），记录错误但不影响订单更新
          console.warn('自动创建/同步提柜管理记录失败:', pickupError)
        }
      }

      // 订单修改提柜/到港日期后，与入库状态、拆柜日期对齐（现在位置含查验/封闭区则对应状态，否则待处理）
      if (
        config.prisma?.model === 'orders' &&
        (processedData.pickup_date !== undefined || processedData.eta_date !== undefined)
      ) {
        try {
          if (processedData.pickup_date !== undefined) {
            await syncAppointmentEstimatedWindowPeriodForOrder({
              orderId: item.order_id,
            })
          }
          await syncInboundPlannedUnloadAtByPickupState({
            orderId: item.order_id,
            userId: permissionResult.user?.id ? BigInt(permissionResult.user.id) : null,
          })
        } catch (syncErr: any) {
          console.warn('[订单更新] 同步入库/预计窗口期失败:', syncErr)
        }
      }

      return NextResponse.json({ data: serializeBigInt(item) })
    } catch (error: any) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          { error: `${config.displayName}不存在` },
          { status: 404 }
        )
      }
      return handleError(error, `更新${config.displayName}失败`)
    }
  }
}

/**
 * 创建通用 DELETE 处理函数
 * 对于 orders 表，使用软删除（将状态改为 'archived'）
 */
export function createDeleteHandler(config: EntityConfig) {
  return async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      // 订单删除对所有人开放：仅校验登录，不校验角色
      const authCheck =
        config.prisma?.model === 'orders'
          ? await checkAuth()
          : await checkEntityPermission(config.permissions.delete, config)
      if (authCheck.error) return authCheck.error

      const resolvedParams = await params
      const prismaModel = getPrismaModel(config)
      
      // 获取主键字段名（默认为 'id'）
      const idField = config.idField || 'id'
      
      // 对于订单表，使用软删除（更新状态为 'archived'）
      if (config.prisma?.model === 'orders' && config.fields.status) {
        const item = await prismaModel.update({
          where: { [idField]: BigInt(resolvedParams.id) },
          data: { status: 'archived' },
        })
        return NextResponse.json({ 
          message: `${config.displayName}已归档`,
          data: serializeBigInt(item)
        })
      }

      // 应收删除：已审核发票同步降级为「已开票」并撤回应收（与账单侧改明细逻辑一致）
      if (config.prisma?.model === 'receivables') {
        const userId = authCheck.user?.id ? BigInt(authCheck.user.id) : null
        const { deleteReceivableAndSyncInvoiceTx, ReceivableWithdrawError } =
          await import('@/lib/finance/invoice-receivable-sync')
        await prisma.$transaction(async (tx) => {
          await deleteReceivableAndSyncInvoiceTx(
            tx,
            BigInt(resolvedParams.id),
            userId
          )
        })
        return NextResponse.json({ message: `删除${config.displayName}成功` })
      }

      // 收款删除：先冲回应收上的已核销，再删收款（核销行由级联删除）
      if (config.prisma?.model === 'payments') {
        const userId = authCheck.user?.id ? BigInt(authCheck.user.id) : null
        const paymentId = BigInt(resolvedParams.id)
        const { reversePaymentAllocationsForDeletionTx } = await import(
          '@/lib/finance/invoice-receivable-sync'
        )
        await prisma.$transaction(async (tx) => {
          await reversePaymentAllocationsForDeletionTx(tx, paymentId, userId)
          await tx.payments.delete({ where: { payment_id: paymentId } })
        })
        return NextResponse.json({ message: `删除${config.displayName}成功` })
      }
      
      // 其他表使用硬删除
      await prismaModel.delete({
        where: { [idField]: BigInt(resolvedParams.id) },
      })

      return NextResponse.json({ message: `删除${config.displayName}成功` })
    } catch (error: any) {
      if (error?.name === 'ReceivableWithdrawError') {
        return NextResponse.json({ error: error.message }, { status: 409 })
      }
      if (error.code === 'P2025') {
        return NextResponse.json(
          { error: `${config.displayName}不存在` },
          { status: 404 }
        )
      }
      return handleError(error, `删除${config.displayName}失败`)
    }
  }
}

/**
 * 创建批量删除处理函数
 * 对于 orders 表，使用软删除（将状态改为 'archived'）
 */
export function createBatchDeleteHandler(config: EntityConfig) {
  return async (request: NextRequest) => {
    try {
      // 订单批量删除对所有人开放：仅校验登录，不校验角色
      const authCheck =
        config.prisma?.model === 'orders'
          ? await checkAuth()
          : await checkEntityPermission(config.permissions.delete, config)
      if (authCheck.error) return authCheck.error

      const body = await request.json()
      const { ids } = body

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json(
          { error: '请提供要删除的记录ID列表' },
          { status: 400 }
        )
      }

      const prismaModel = getPrismaModel(config)
      const idField = config.idField || 'id'

      // 转换为 BigInt（如果是数字字符串）
      const bigIntIds = ids.map((id: string | number) => {
        try {
          return BigInt(id)
        } catch {
          throw new Error(`无效的ID: ${id}`)
        }
      })

      // 对于订单表，使用软删除（批量更新状态为 'archived'）
      if (config.prisma?.model === 'orders' && config.fields.status) {
        const result = await prismaModel.updateMany({
          where: {
            [idField]: {
              in: bigIntIds,
            },
          },
          data: { status: 'archived' },
        })

        return NextResponse.json({
          message: `成功归档 ${result.count} 条${config.displayName}记录`,
          count: result.count,
        })
      }

      // 应收批量删除：每条与单条删除相同逻辑，整批在同一事务内（任一条有核销则整批失败）
      if (config.prisma?.model === 'receivables') {
        const userId = authCheck.user?.id ? BigInt(authCheck.user.id) : null
        const { deleteReceivableAndSyncInvoiceTx } = await import(
          '@/lib/finance/invoice-receivable-sync'
        )
        try {
          await prisma.$transaction(async (tx) => {
            for (const rid of bigIntIds) {
              await deleteReceivableAndSyncInvoiceTx(tx, rid, userId)
            }
          })
        } catch (e: unknown) {
          const err = e as Error
          if (err?.name === 'ReceivableWithdrawError') {
            return NextResponse.json({ error: err.message }, { status: 409 })
          }
          throw e
        }
        return NextResponse.json({
          message: `成功删除 ${bigIntIds.length} 条${config.displayName}记录`,
          count: bigIntIds.length,
        })
      }

      // 收款批量删除：逐笔冲回应收再删收款（与单条删除一致）
      if (config.prisma?.model === 'payments') {
        const userId = authCheck.user?.id ? BigInt(authCheck.user.id) : null
        const { reversePaymentAllocationsForDeletionTx } = await import(
          '@/lib/finance/invoice-receivable-sync'
        )
        await prisma.$transaction(async (tx) => {
          for (const pid of bigIntIds) {
            await reversePaymentAllocationsForDeletionTx(tx, pid, userId)
            await tx.payments.delete({ where: { payment_id: pid } })
          }
        })
        return NextResponse.json({
          message: `成功删除 ${bigIntIds.length} 条${config.displayName}记录`,
          count: bigIntIds.length,
        })
      }

      // 其他表使用硬删除
      const result = await prismaModel.deleteMany({
        where: {
          [idField]: {
            in: bigIntIds,
          },
        },
      })

      return NextResponse.json({
        message: `成功删除 ${result.count} 条${config.displayName}记录`,
        count: result.count,
      })
    } catch (error: any) {
      return handleError(error, `批量删除${config.displayName}失败`)
    }
  }
}

/**
 * 创建批量更新处理函数
 */
export function createBatchUpdateHandler(config: EntityConfig) {
  return async (request: NextRequest) => {
    try {
      const permissionResult = await checkEntityPermission(
        config.permissions.update,
        config
      )
      if (permissionResult.error) return permissionResult.error

      const body = await request.json()
      const { ids, updates } = body

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json(
          { error: '请提供要更新的记录ID列表' },
          { status: 400 }
        )
      }

      if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
        return NextResponse.json(
          { error: '请提供要更新的字段' },
          { status: 400 }
        )
      }

      const prismaModel = getPrismaModel(config)
      const idField = config.idField || 'id'

      // 转换为 BigInt（如果是数字字符串）
      const bigIntIds = ids.map((id: string | number) => {
        try {
          return BigInt(id)
        } catch {
          throw new Error(`无效的ID: ${id}`)
        }
      })

      // 处理字段映射和类型转换
      const processedUpdates: any = {}
      
      // 特殊处理：用户表的密码字段需要哈希
      if (config.prisma?.model === 'users' && updates.password) {
        const bcrypt = await import('bcryptjs')
        const passwordHash = await bcrypt.default.hash(updates.password as string, 10)
        processedUpdates.password_hash = passwordHash
        // 从 updates 中移除 password，避免后续处理
        delete updates.password
      }
      
      Object.entries(updates).forEach(([key, value]) => {
        // 查找字段配置
        const fieldConfig = config.fields[key]
        if (fieldConfig?.readonly || fieldConfig?.computed) {
          return
        }

        // 如果是relation字段，使用relationField映射
        let actualKey = key
        if (fieldConfig?.relation) {
          actualKey =
            fieldConfig.relationField || (key.endsWith('_id') ? key : `${key}_id`)
        } else if (key === 'origin_location') {
          actualKey = 'origin_location_id'
        } else if (key === 'destination_location') {
          actualKey = 'location_id'
        }
        
        // 处理 boolean 字段：确保 false 值不被过滤，并转换为布尔类型
        if (fieldConfig?.type === 'boolean') {
          // boolean 字段：false 和 true 都是有效值
          if (value !== undefined && value !== null) {
            processedUpdates[actualKey] = Boolean(value)
          }
          return // 跳过后续处理
        }
        
        if (value !== null && value !== undefined && value !== '') {
          // 处理日期字段
          if (fieldConfig?.type === 'date' && typeof value === 'string') {
            // 日期字符串格式：YYYY-MM-DD，转换为 Date 对象（UTC）
            const [year, month, day] = value.split('-').map(Number)
            processedUpdates[actualKey] = new Date(Date.UTC(year, month - 1, day))
          } else if (fieldConfig?.type === 'datetime' && typeof value === 'string') {
            // 日期时间字符串，手动解析为 Date（不进行时区转换）
            // 格式：YYYY-MM-DDTHH:mm 或 YYYY-MM-DDTHH:mm:ss
            const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{3}))?/)
            if (match) {
              const [, year, month, day, hours, minutes, seconds = '0', milliseconds = '0'] = match
              // 使用 UTC 方法创建 Date 对象，这样就不会进行时区转换
              processedUpdates[actualKey] = new Date(Date.UTC(
                parseInt(year, 10),
                parseInt(month, 10) - 1,
                parseInt(day, 10),
                parseInt(hours, 10),
                parseInt(minutes, 10),
                parseInt(seconds, 10),
                parseInt(milliseconds, 10)
              ))
            } else {
              // 如果不是预期格式，尝试直接解析（可能会进行时区转换，但这是后备方案）
              processedUpdates[actualKey] = new Date(value)
            }
          } else if (actualKey === 'total_pallets') {
            // total_pallets 是计算字段，不能直接更新
            // 如果需要修改，需要更新 order_detail 中的 estimated_pallets
            // 这里我们暂时忽略，不添加到 processedUpdates 中
            // 跳过这个字段
          } else if (actualKey === 'container_volume') {
            // container_volume 是计算字段，不能直接更新
            // 由系统根据 order_detail 的 volume 总和自动计算
            // 跳过这个字段
          } else if (fieldConfig?.type === 'number' || fieldConfig?.type === 'currency') {
            // 数值字段，确保是数字类型
            processedUpdates[actualKey] = typeof value === 'string' ? parseFloat(value) : value
          } else if (fieldConfig?.type === 'location' || actualKey.endsWith('_location_id')) {
            // location 字段：转换为 BigInt（如果是数字或字符串数字）
            if (typeof value === 'number') {
              processedUpdates[actualKey] = BigInt(value)
            } else if (typeof value === 'string' && !isNaN(Number(value))) {
              processedUpdates[actualKey] = BigInt(value)
            } else {
              processedUpdates[actualKey] = value
            }
          } else {
            processedUpdates[actualKey] = value
          }
        }
      })

      // 执行批量更新（订单批量改「已取消」时，同步清理下游关联）
      let result: { count: number }
      if (
        config.prisma?.model === 'orders' &&
        processedUpdates.status === ORDER_STATUS_CANCELLED
      ) {
        result = await prisma.$transaction(async (tx) => {
          const updated = await tx.orders.updateMany({
            where: {
              [idField]: {
                in: bigIntIds,
              },
            },
            data: processedUpdates,
          })
          for (const oid of bigIntIds) {
            await purgeOperationalDataForCancelledOrder(tx, oid)
          }
          return { count: updated.count }
        })
      } else {
        result = await prismaModel.updateMany({
          where: {
            [idField]: {
              in: bigIntIds,
            },
          },
          data: processedUpdates,
        })
      }

      if (config.prisma?.model === 'delivery_appointments' && result.count > 0) {
        try {
          const appts = await prisma.delivery_appointments.findMany({
            where: { appointment_id: { in: bigIntIds } },
            select: { order_id: true },
          })
          const { scheduleStorageInvoiceSync } = await import(
            '@/lib/finance/storage-invoice-sync'
          )
          const uid = permissionResult.user?.id
            ? BigInt(permissionResult.user.id)
            : null
          const seen = new Set<string>()
          for (const a of appts) {
            if (!a.order_id) continue
            const k = a.order_id.toString()
            if (seen.has(k)) continue
            seen.add(k)
            scheduleStorageInvoiceSync(a.order_id, uid)
          }
        } catch (e) {
          console.warn(
            '[batch-update] delivery_appointments 仓储账单同步调度失败',
            e
          )
        }
      }

      return NextResponse.json({
        message: `成功更新 ${result.count} 条${config.displayName}记录`,
        count: result.count,
        data: serializeBigInt(result),
      })
    } catch (error: any) {
      return handleError(error, `批量更新${config.displayName}失败`)
    }
  }
}
