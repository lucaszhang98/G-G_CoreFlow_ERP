/**
 * CRUD 通用常量
 */

/**
 * 审计字段列表 - 这些字段由系统自动维护，不应该显示在前端
 * 包括：
 * - ID字段（数据库自动生成）
 * - created_by（创建人ID，前端自动填入当前登录用户）
 * - updated_by（更新人ID，前端自动填入当前登录用户）
 * - created_at（创建时间，前端自动填入当前时间）
 * - updated_at（更新时间，前端自动填入当前时间）
 */
export const AUDIT_FIELDS = [
  'created_by',
  'updated_by',
  'created_at',
  'updated_at',
] as const

/**
 * 获取实体的ID字段名（根据配置或默认值）
 */
export function getIdField(config: { idField?: string }): string {
  return config.idField || 'id'
}

/**
 * 检查字段是否为审计字段
 */
export function isAuditField(fieldKey: string, idField?: string): boolean {
  // ID字段也是审计字段（数据库自动生成）
  if (idField && fieldKey === idField) {
    return true
  }
  // 其他审计字段
  return AUDIT_FIELDS.includes(fieldKey as any)
}

/**
 * 过滤掉审计字段
 */
export function filterAuditFields<T extends string>(
  fields: T[],
  idField?: string
): T[] {
  return fields.filter((field) => !isAuditField(field, idField))
}

