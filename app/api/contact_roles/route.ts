import { NextRequest } from 'next/server'
import { createListHandler, createCreateHandler } from '@/lib/crud/api-handler'
import { contactRoleConfig } from '@/lib/crud/configs/contact-roles'

// GET - 获取联系人列表
export const GET = createListHandler(contactRoleConfig)

// POST - 创建联系人
export const POST = createCreateHandler(contactRoleConfig)
