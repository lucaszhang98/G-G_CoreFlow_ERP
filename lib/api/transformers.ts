/**
 * 数据转换器 - 统一处理 Prisma 查询结果的数据转换
 * 将数据库字段名转换为前端友好的字段名
 */

import { serializeBigInt } from './helpers'

/**
 * 数据转换配置
 */
interface TransformConfig {
  model: string
  fieldMappings?: Record<string, string> // 字段映射：数据库字段 -> 前端字段
  relationMappings?: Record<string, string> // 关系映射：数据库关系 -> 前端字段
  customTransform?: (item: any) => any // 自定义转换函数
}

/**
 * 通用数据转换器
 */
export function transformData(item: any, config: TransformConfig): any {
  if (!item) return null

  // 先序列化 BigInt
  let transformed = serializeBigInt(item)

  // 应用字段映射
  if (config.fieldMappings) {
    for (const [dbField, frontendField] of Object.entries(config.fieldMappings)) {
      if (transformed[dbField] !== undefined) {
        transformed[frontendField] = transformed[dbField]
        delete transformed[dbField]
      }
    }
  }

  // 应用关系映射
  if (config.relationMappings) {
    for (const [dbRelation, frontendField] of Object.entries(config.relationMappings)) {
      if (transformed[dbRelation]) {
        transformed[frontendField] = transformed[dbRelation]
        delete transformed[dbRelation]
      } else {
        transformed[frontendField] = null
      }
    }
  }

  // 应用自定义转换
  if (config.customTransform) {
    transformed = config.customTransform(transformed)
  }

  return transformed
}

/**
 * 批量数据转换
 */
export function transformDataList(items: any[], config: TransformConfig): any[] {
  return items.map(item => transformData(item, config))
}

/**
 * 预定义的转换配置
 */
export const TRANSFORM_CONFIGS: Record<string, TransformConfig> = {
  vehicles: {
    model: 'vehicles',
    relationMappings: {
      carriers: 'carrier',
    },
  },
  trailers: {
    model: 'trailers',
    relationMappings: {
      departments: 'department',
    },
  },
  drivers: {
    model: 'drivers',
    relationMappings: {
      carriers: 'carrier',
      contact_roles: 'contact',
    },
    customTransform: (item: any) => {
      if (item.contact_roles) {
        item.contact = {
          name: item.contact_roles.name || '',
          phone: item.contact_roles.phone || null,
          email: item.contact_roles.email || null,
        }
        delete item.contact_roles
      } else {
        item.contact = null
      }
      return item
    },
  },
  carriers: {
    model: 'carriers',
    relationMappings: {
      contact_roles: 'contact',
    },
    customTransform: (item: any) => {
      if (item.contact_roles) {
        item.contact = {
          name: item.contact_roles.name || '',
          phone: item.contact_roles.phone || null,
          email: item.contact_roles.email || null,
        }
        delete item.contact_roles
      } else {
        item.contact = null
      }
      return item
    },
  },
  warehouses: {
    model: 'warehouses',
    relationMappings: {
      locations: 'location',
      users_warehouses_contact_user_idTousers: 'contact_user',
    },
    customTransform: (item: any) => {
      if (!item.locations) {
        item.location = null
      }
      if (!item.users_warehouses_contact_user_idTousers) {
        item.contact_user = null
      }
      return item
    },
  },
  orders: {
    model: 'orders',
    customTransform: (item: any) => {
      // 计算整柜体积
      if (item.order_detail && Array.isArray(item.order_detail)) {
        const totalVolume = item.order_detail.reduce((sum: number, detail: any) => {
          let volume = 0
          if (detail.volume !== null && detail.volume !== undefined) {
            if (typeof detail.volume === 'object' && 'toString' in detail.volume) {
              volume = parseFloat(detail.volume.toString()) || 0
            } else if (typeof detail.volume === 'string') {
              volume = parseFloat(detail.volume) || 0
            } else {
              volume = Number(detail.volume) || 0
            }
          }
          return sum + volume
        }, 0)
        item.container_volume = totalVolume
      } else {
        item.container_volume = 0
      }
      return item
    },
  },
}

/**
 * 获取转换配置
 */
export function getTransformConfig(model: string): TransformConfig | null {
  return TRANSFORM_CONFIGS[model] || null
}

/**
 * 应用转换配置
 */
export function applyTransform(item: any, model: string): any {
  const config = getTransformConfig(model)
  if (config) {
    return transformData(item, config)
  }
  return serializeBigInt(item)
}

/**
 * 批量应用转换
 */
export function applyTransformList(items: any[], model: string): any[] {
  const config = getTransformConfig(model)
  if (config) {
    return transformDataList(items, config)
  }
  return items.map(item => serializeBigInt(item))
}

