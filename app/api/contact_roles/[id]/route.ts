import { createDetailHandler, createUpdateHandler, createDeleteHandler } from '@/lib/crud/api-handler'
import { contactRoleConfig } from '@/lib/crud/configs/contact-roles'

// GET - 获取单个联系人
export const GET = createDetailHandler(contactRoleConfig)

// PUT - 更新联系人
export const PUT = createUpdateHandler(contactRoleConfig)

// DELETE - 删除联系人
export const DELETE = createDeleteHandler(contactRoleConfig)
