/**
 * 仓库详情 API - 使用通用框架
 */

import { NextRequest } from 'next/server'
import { createDetailHandler, createUpdateHandler, createDeleteHandler } from '@/lib/crud/api-handler'
import { warehouseConfig } from '@/lib/crud/configs/warehouses'

export const GET = createDetailHandler(warehouseConfig)
export const PUT = createUpdateHandler(warehouseConfig)
export const DELETE = createDeleteHandler(warehouseConfig)



