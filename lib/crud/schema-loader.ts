/**
 * Schema 加载器
 * 根据 schema 名称动态导入对应的 Zod schema
 */

import { z } from 'zod'
import { userCreateSchema, userUpdateSchema } from '@/lib/validations/user'
import { customerCreateSchema, customerUpdateSchema } from '@/lib/validations/customer'
import { warehouseCreateSchema, warehouseUpdateSchema } from '@/lib/validations/warehouse'
import { departmentCreateSchema, departmentUpdateSchema } from '@/lib/validations/department'
import { locationCreateSchema, locationUpdateSchema } from '@/lib/validations/location'
import { carrierCreateSchema, carrierUpdateSchema } from '@/lib/validations/carrier'
import { vehicleCreateSchema, vehicleUpdateSchema } from '@/lib/validations/vehicle'
import { trailerCreateSchema, trailerUpdateSchema } from '@/lib/validations/trailer'
import { driverCreateSchema, driverUpdateSchema } from '@/lib/validations/driver'
import { orderCreateSchema, orderUpdateSchema } from '@/lib/validations/order'

type SchemaMap = {
  create: z.ZodSchema
  update: z.ZodSchema
}

const schemaMap: Record<string, SchemaMap> = {
  user: {
    create: userCreateSchema,
    update: userUpdateSchema,
  },
  customer: {
    create: customerCreateSchema,
    update: customerUpdateSchema,
  },
  warehouse: {
    create: warehouseCreateSchema,
    update: warehouseUpdateSchema,
  },
  department: {
    create: departmentCreateSchema,
    update: departmentUpdateSchema,
  },
  location: {
    create: locationCreateSchema,
    update: locationUpdateSchema,
  },
  carrier: {
    create: carrierCreateSchema,
    update: carrierUpdateSchema,
  },
  vehicle: {
    create: vehicleCreateSchema,
    update: vehicleUpdateSchema,
  },
  trailer: {
    create: trailerCreateSchema,
    update: trailerUpdateSchema,
  },
  driver: {
    create: driverCreateSchema,
    update: driverUpdateSchema,
  },
  order: {
    create: orderCreateSchema,
    update: orderUpdateSchema,
  },
}

/**
 * 获取指定实体的 schema
 */
export function getSchema(schemaName: string, type: 'create' | 'update'): z.ZodSchema {
  const schemas = schemaMap[schemaName]
  if (!schemas) {
    throw new Error(`Schema not found for entity: ${schemaName}`)
  }
  return schemas[type]
}

