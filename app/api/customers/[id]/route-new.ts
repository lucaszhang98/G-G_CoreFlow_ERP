/**
 * 客户详情 API - 使用通用框架
 */

import { NextRequest } from 'next/server'
import { createDetailHandler, createUpdateHandler, createDeleteHandler } from '@/lib/crud/api-handler'
import { customerConfig } from '@/lib/crud/configs/customers'

export const GET = createDetailHandler(customerConfig)
export const PUT = createUpdateHandler(customerConfig)
export const DELETE = createDeleteHandler(customerConfig)



