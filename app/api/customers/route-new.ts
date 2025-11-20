/**
 * 客户管理 API - 使用通用框架
 */

import { NextRequest } from 'next/server'
import { createListHandler, createCreateHandler } from '@/lib/crud/api-handler'
import { customerConfig } from '@/lib/crud/configs/customers'

export const GET = createListHandler(customerConfig)
export const POST = createCreateHandler(customerConfig)



