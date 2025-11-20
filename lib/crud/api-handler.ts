/**
 * 通用 CRUD API 处理函数
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAuth, checkPermission, parsePaginationParams, buildPaginationResponse, handleValidationError, handleError, serializeBigInt } from '@/lib/api/helpers'
import { EntityConfig } from './types'
import { getSchema } from './schema-loader'
import prisma from '@/lib/prisma'
import { z } from 'zod'

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
      
      // 搜索条件
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

      // 状态筛选（如果有 status 字段）
      if (config.fields.status) {
        const status = searchParams.get('status')
        if (status) {
          where.status = status
        }
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
        // 处理订单数据：确保 order_id 是字符串
        if (config.prisma?.model === 'orders' && serialized.order_id) {
          serialized.order_id = String(serialized.order_id)
        }
        // 处理用户数据：departments -> department
        if (config.prisma?.model === 'users' && serialized.departments) {
          serialized.department = serialized.departments
          delete serialized.departments
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
        // 处理仓库数据：locations -> location, users -> contact_user
        if (config.prisma?.model === 'warehouses') {
          if (serialized.locations) {
            serialized.location = serialized.locations
            delete serialized.locations
          }
          if (serialized.users) {
            serialized.contact_user = serialized.users
            delete serialized.users
          }
        }
        // 处理部门数据：departments -> parent, users -> manager
        if (config.prisma?.model === 'departments') {
          if (serialized.departments) {
            serialized.parent = serialized.departments
            delete serialized.departments
          }
          if (serialized.users) {
            serialized.manager = serialized.users
            delete serialized.users
          }
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
      if (config.prisma?.model === 'departments' && transformed.departments) {
        transformed.parent = transformed.departments
        delete transformed.departments
      }
      
      // 处理用户数据：departments -> department
      if (config.prisma?.model === 'users' && transformed.departments) {
        transformed.department = transformed.departments
        delete transformed.departments
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
      
      // 处理仓库数据：locations -> location, users -> contact_user
      if (config.prisma?.model === 'warehouses') {
        if (transformed.locations) {
          transformed.location = transformed.locations
          delete transformed.locations
        }
        if (transformed.users) {
          transformed.contact_user = transformed.users
          delete transformed.users
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
