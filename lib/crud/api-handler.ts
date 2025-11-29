/**
 * 通用 CRUD API 处理函数
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkPermission, parsePaginationParams, buildPaginationResponse, handleValidationError, handleError, serializeBigInt } from '@/lib/api/helpers'
import { EntityConfig } from './types'
import { getSchema } from './schema-loader'
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
      // 检查权限
      const permissionResult = await checkPermission(config.permissions.list)
      if (permissionResult.error) return permissionResult.error

      const searchParams = request.nextUrl.searchParams
      const { page, limit, sort, order } = parsePaginationParams(
        searchParams,
        config.list.defaultSort,
        config.list.defaultOrder
      )
      const search = searchParams.get('search') || ''

      // 构建查询条件
      const where: any = {}
      
      // 简单搜索条件（模糊搜索）
      if (search && config.list.searchFields) {
        where.OR = config.list.searchFields.map(field => {
          const fieldConfig = config.fields[field]
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
      if (config.list.filterFields) {
        config.list.filterFields.forEach((filterField) => {
          if (filterField.type === 'select') {
            const filterValue = searchParams.get(`filter_${filterField.field}`)
            // 忽略 "__all__" 值（表示清除筛选）
            if (filterValue && filterValue !== '__all__') {
              where[filterField.field] = filterValue
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
              // 如果指定了多个日期字段，使用 OR 逻辑
              if (filterField.dateFields && filterField.dateFields.length > 0) {
                if (!where.OR) where.OR = []
                filterField.dateFields.forEach((dateField) => {
                  where.OR!.push({ [dateField]: dateCondition })
                })
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
              // 如果指定了多个数值字段，使用 OR 逻辑
              if (filterField.numberFields && filterField.numberFields.length > 0) {
                if (!where.OR) where.OR = []
                filterField.numberFields.forEach((numField) => {
                  where.OR!.push({ [numField]: numCondition })
                })
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
      if (config.list.advancedSearchFields) {
        const advancedConditions: any[] = []
        
        config.list.advancedSearchFields.forEach((searchField) => {
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

      // 状态筛选（如果有 status 字段）
      if (config.fields.status) {
        const status = searchParams.get('status')
        const includeArchived = searchParams.get('includeArchived') === 'true'
        
        if (status) {
          where.status = status
        } else if (!includeArchived && config.prisma?.model === 'orders') {
          // 对于订单表，默认排除"完成留档"状态（除非明确要求包含）
          where.status = { not: 'archived' }
        }
      } else if (!searchParams.get('includeArchived') && config.prisma?.model === 'orders') {
        // 如果没有 status 字段配置但需要过滤归档订单
        where.status = { not: 'archived' }
      }

      // 查询数据
      const prismaModel = getPrismaModel(config)

      const queryOptions: any = {
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sort]: order },
      }

      // 添加 include 或 select
      if (config.prisma?.include) {
        queryOptions.include = config.prisma.include
      } else if (config.prisma?.select) {
        queryOptions.select = config.prisma.select
      }

      const [items, total] = await Promise.all([
        prismaModel.findMany(queryOptions),
        prismaModel.count({ where }),
      ])

      // 数据转换（根据配置的 prisma 模型处理）
      const transformedItems = items.map((item: any) => {
        const serialized = serializeBigInt(item)
        // 处理订单数据：确保 order_id 是字符串，处理 carriers 关联
        if (config.prisma?.model === 'orders') {
          if (serialized.order_id) {
            serialized.order_id = String(serialized.order_id)
          }
          // 处理 carriers 关联：carriers -> carrier
          if (serialized.carriers) {
            serialized.carrier = serialized.carriers
            delete serialized.carriers
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
      })

      return NextResponse.json(
        buildPaginationResponse(transformedItems, total, page, limit)
      )
    } catch (error) {
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

      // 处理 BigInt 字段
      const processedData: any = {}
      for (const [key, value] of Object.entries(submitData as Record<string, any>)) {
        const fieldConfig = config.fields[key]
        if (fieldConfig?.relation && fieldConfig.relation.valueField) {
          // 关系字段需要转换为 BigInt
          if (value) {
            processedData[fieldConfig.relation.valueField] = BigInt(value as number)
          }
        } else if (typeof value === 'number' && key.endsWith('_id')) {
          processedData[key] = BigInt(value)
        } else {
          processedData[key] = value
        }
      }

      // 自动添加系统维护字段（创建人/时间、修改人/时间）
      const { addSystemFields } = await import('@/lib/api/helpers')
      addSystemFields(processedData, permissionResult.user, true)

      const prismaModel = getPrismaModel(config)
      const item = await prismaModel.create({
        data: processedData,
      })

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

      // 处理 BigInt 字段
      const processedData: any = {}
      for (const [key, value] of Object.entries(submitData as Record<string, any>)) {
        const fieldConfig = config.fields[key]
        if (fieldConfig?.relation && fieldConfig.relation.valueField) {
          if (value) {
            processedData[fieldConfig.relation.valueField] = BigInt(value as number)
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
      const item = await prismaModel.update({
        where: { [idField]: BigInt(resolvedParams.id) },
        data: processedData,
      })

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

      // 处理日期字段
      const processedUpdates: any = {}
      Object.entries(updates).forEach(([key, value]) => {
        const fieldConfig = config.fields[key]
        if (fieldConfig && value !== null && value !== undefined && value !== '') {
          // 处理日期字段
          if (fieldConfig.type === 'date' && typeof value === 'string') {
            // 日期字符串格式：YYYY-MM-DD，转换为 Date 对象（UTC）
            const [year, month, day] = value.split('-').map(Number)
            processedUpdates[key] = new Date(Date.UTC(year, month - 1, day))
          } else if (fieldConfig.type === 'datetime' && typeof value === 'string') {
            // 日期时间字符串，直接转换为 Date
            processedUpdates[key] = new Date(value)
          } else if (fieldConfig.type === 'number' || fieldConfig.type === 'currency') {
            // 数值字段，确保是数字类型
            processedUpdates[key] = typeof value === 'string' ? parseFloat(value) : value
          } else {
            processedUpdates[key] = value
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
