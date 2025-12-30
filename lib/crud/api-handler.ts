/**
 * 通用 CRUD API 处理函数
 * 
 * 使用统一的框架处理所有 CRUD 操作，减少代码重复
 * 支持数据转换、查询构建、错误处理等通用功能
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkPermission, parsePaginationParams, buildPaginationResponse, handleValidationError, handleError, serializeBigInt } from '@/lib/api/helpers'
import { applyTransform, applyTransformList } from '@/lib/api/transformers'
import { resolveParams, withApiHandler } from '@/lib/api/middleware'
import { EntityConfig } from './types'
import { getSchema } from './schema-loader'
import { buildRelationFilterCondition } from './relation-filter-helper'
import { enhanceConfigWithSearchFields } from './search-config-generator'
import prisma from '@/lib/prisma'

/**
 * 获取 Prisma 模型
 */
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
      const permissionResult = await checkPermission(enhancedConfig.permissions.list)
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
      if (search && enhancedConfig.list.searchFields) {
        where.OR = enhancedConfig.list.searchFields.map(field => {
          const fieldConfig = enhancedConfig.fields[field]
          if (fieldConfig?.relation) {
            // 关系字段搜索需要特殊处理
            return {}
          }
          return {
            [field]: { contains: search, mode: 'insensitive' as const }
          }
        }).filter(Boolean)
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
                // 普通 select 字段（包括状态）
                where[filterField.field] = filterValue
                
                if (process.env.NODE_ENV === 'development') {
                  console.log(`[createListHandler] 设置筛选条件: ${filterField.field} = ${filterValue}`)
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
      if (!searchParams.get('includeArchived') && enhancedConfig.prisma?.model === 'orders') {
        // 对于订单表，如果没有明确选择状态，默认排除"完成留档"状态
        const statusFilterValue = searchParams.get('filter_status')
        if (!statusFilterValue || statusFilterValue === '__all__') {
          where.status = { not: 'archived' }
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

      const queryOptions: any = {
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sort]: order },
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

      let items: any[] = []
      let total = 0
      
      try {
        [items, total] = await Promise.all([
          prismaModel.findMany(queryOptions),
          prismaModel.count({ where }),
        ])
        
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

      // 数据转换（根据配置的 prisma 模型处理）
      const transformedItems = items.map((item: any) => {
        try {
          const serialized = serializeBigInt(item)
          
          // 开发环境：记录第一条数据的结构
          if (process.env.NODE_ENV === 'development' && items.indexOf(item) === 0) {
            console.log('[createListHandler] 第一条数据（转换前）:', {
              hasCustomers: !!serialized.customers,
              hasUsersOrdersUserIdTousers: !!serialized.users_orders_user_idTousers,
              hasCarriers: !!serialized.carriers,
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
          return serialized
        } catch (error: any) {
          console.error('数据转换错误:', error, 'item:', item)
          // 如果转换失败，返回序列化后的原始数据
          return serializeBigInt(item)
        }
      })

      return NextResponse.json(
        buildPaginationResponse(transformedItems, total, page, limit)
      )
    } catch (error: any) {
      console.error(`[createListHandler] 获取${config.displayName}列表失败:`, error)
      console.error('错误详情:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
        code: error?.code,
      })
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
    { params }: { params: Promise<{ id: string }> | { id: string } }
  ) => {
    try {
      const permissionResult = await checkPermission(config.permissions.list)
      if (permissionResult.error) return permissionResult.error

      const resolvedParams = params instanceof Promise ? await params : params
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
      const permissionResult = await checkPermission(config.permissions.create)
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
        const fieldConfig = config.fields[key]
        // 跳过只读/计算字段（如 container_volume）
        if (fieldConfig?.readonly || fieldConfig?.computed) {
          continue
        }
        if (fieldConfig?.relation && fieldConfig.relation.valueField) {
          // 关系字段需要转换为 BigInt
          if (value) {
            processedData[fieldConfig.relation.valueField] = BigInt(value as number)
          }
        } else if (typeof value === 'number' && key.endsWith('_id')) {
          processedData[key] = BigInt(value)
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
      }

      // 自动添加系统维护字段（创建人/时间、修改人/时间）
      const { addSystemFields } = await import('@/lib/api/helpers')
      addSystemFields(processedData, permissionResult.user, true)

      const prismaModel = getPrismaModel(config)
      const item = await prismaModel.create({
        data: processedData,
      })

      // 对于订单表，如果创建时操作方式就是"拆柜"（unload），自动创建入库记录
      if (config.prisma?.model === 'orders' && processedData.operation_mode === 'unload') {
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
            await prisma.inbound_receipt.create({
              data: {
                order_id: item.order_id,
                warehouse_id: warehouseId,
                status: 'pending',
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

      // 对于订单表，自动创建提柜管理记录
      if (config.prisma?.model === 'orders') {
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
                status: 'planned', // 默认状态：计划中
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
    { params }: { params: Promise<{ id: string }> | { id: string } }
  ) => {
    try {
      const permissionResult = await checkPermission(config.permissions.update)
      if (permissionResult.error) return permissionResult.error

      const resolvedParams = params instanceof Promise ? await params : params
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

      // 处理 BigInt 字段和 boolean 字段
      const processedData: any = {}
      for (const [key, value] of Object.entries(submitData as Record<string, any>)) {
        const fieldConfig = config.fields[key]
        
        // 处理 boolean 字段：确保转换为布尔类型
        if (fieldConfig?.type === 'boolean') {
          if (value !== undefined && value !== null) {
            processedData[key] = Boolean(value)
          }
          continue // 跳过后续处理
        }
        
        if (fieldConfig?.relation) {
          if (value) {
            // 优先使用 relationField，否则使用 valueField
            const targetField = fieldConfig.relationField || fieldConfig.relation.valueField || key
            processedData[targetField] = BigInt(value as number)
          }
        } else if (typeof value === 'number' && key.endsWith('_id')) {
          processedData[key] = BigInt(value)
        } else {
          processedData[key] = value
        }
      }

      // 自动添加系统维护字段（只更新修改人/时间）
      const { addSystemFields } = await import('@/lib/api/helpers')
      addSystemFields(processedData, permissionResult.user, false)

      const prismaModel = getPrismaModel(config)
      
      // 对于订单表，检查 operation_mode 是否变为"拆柜"（unload），如果是则自动创建入库记录
      if (config.prisma?.model === 'orders' && processedData.operation_mode === 'unload') {
        // 先获取当前订单，检查旧操作方式和是否已经有入库记录
        const currentOrder = await prismaModel.findUnique({
          where: { [idField]: BigInt(resolvedParams.id) },
          select: { order_id: true, operation_mode: true },
        })
        
        if (currentOrder && currentOrder.operation_mode !== 'unload') {
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
              
              await prisma.inbound_receipt.create({
                data: {
                  order_id: currentOrder.order_id,
                  warehouse_id: warehouseId,
                  status: 'pending',
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
              
              await prisma.inbound_receipt.create({
                data: {
                  order_id: currentOrder.order_id,
                  warehouse_id: warehouseId,
                  status: 'pending',
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
      
      const item = await prismaModel.update({
        where: { [idField]: BigInt(resolvedParams.id) },
        data: processedData,
      })

      // 对于订单表，确保提柜管理记录存在（如果不存在则创建）
      if (config.prisma?.model === 'orders') {
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
                status: 'planned', // 默认状态：计划中
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
    { params }: { params: Promise<{ id: string }> | { id: string } }
  ) => {
    try {
      const permissionResult = await checkPermission(config.permissions.delete)
      if (permissionResult.error) return permissionResult.error

      const resolvedParams = params instanceof Promise ? await params : params
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
      
      // 其他表使用硬删除
      await prismaModel.delete({
        where: { [idField]: BigInt(resolvedParams.id) },
      })

      return NextResponse.json({ message: `删除${config.displayName}成功` })
    } catch (error: any) {
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
      const permissionResult = await checkPermission(config.permissions.delete)
      if (permissionResult.error) return permissionResult.error

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
      const permissionResult = await checkPermission(config.permissions.update)
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
        
        // 如果是relation字段，使用relationField映射
        let actualKey = key
        if (fieldConfig?.relation) {
          actualKey = fieldConfig.relationField || fieldConfig.relation.valueField || key
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

      // 执行批量更新
      const result = await prismaModel.updateMany({
        where: {
          [idField]: {
            in: bigIntIds,
          },
        },
        data: processedUpdates,
      })

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
