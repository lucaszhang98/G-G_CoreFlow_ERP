import { checkPermission } from '@/lib/api/helpers'

/**
 * 邮件助手权限（系统工具）：管理员 + 操作部门
 * ops_dept 等账号角色为 oms_operator
 */
export const MAIL_ASSISTANT_ROLES = ['admin', 'oms_manager', 'oms_operator'] as const

export type MailAssistantRole = (typeof MAIL_ASSISTANT_ROLES)[number]

export function canAccessMailAssistant(role: string | null | undefined): boolean {
  if (!role) return false
  return (MAIL_ASSISTANT_ROLES as readonly string[]).includes(role)
}

export function isMailAssistantAdmin(role: string | null | undefined): boolean {
  return role === 'admin'
}

/** API 路由统一鉴权 */
export async function checkMailAssistantPermission() {
  return checkPermission([...MAIL_ASSISTANT_ROLES])
}
