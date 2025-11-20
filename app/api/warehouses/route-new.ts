/**
 * 仓库管理 API - 使用通用框架
 */

import { NextRequest } from 'next/server'
import { createListHandler, createCreateHandler } from '@/lib/crud/api-handler'
import { warehouseConfig } from '@/lib/crud/configs/warehouses'

export const GET = createListHandler(warehouseConfig)
export const POST = createCreateHandler(warehouseConfig)



