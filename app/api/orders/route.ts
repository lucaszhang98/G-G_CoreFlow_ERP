import { NextRequest } from 'next/server'
import { createListHandler, createCreateHandler } from '@/lib/crud/api-handler'
import { orderConfig } from '@/lib/crud/configs/orders'

// GET - 获取订单列表
export const GET = createListHandler(orderConfig)

// POST - 创建订单
export const POST = createCreateHandler(orderConfig)


