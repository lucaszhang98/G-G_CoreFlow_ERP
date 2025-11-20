/**
 * 通用 CRUD 框架类型定义
 * 所有配置对象必须完全可序列化（不能包含函数、类实例等）
 */

/**
 * 字段类型
 */
export type FieldType = 
  | 'text' 
  | 'number' 
  | 'email' 
  | 'phone' 
  | 'date' 
  | 'select' 
  | 'textarea' 
  | 'currency'
  | 'badge'
  | 'relation'

/**
 * 字段配置（完全可序列化）
 */
export interface FieldConfig {
  key: string
  label: string
  type: FieldType
  required?: boolean
  sortable?: boolean
  searchable?: boolean
  // 表单配置
  placeholder?: string
  options?: { label: string; value: string }[] // select 类型使用
  // 关系字段配置
  relation?: {
    model: string
    displayField: string
    valueField?: string
  }
}

/**
 * 实体配置（完全可序列化）
 */
export interface EntityConfig {
  // 基本信息
  name: string
  displayName: string
  pluralName: string
  
  // API 路径
  apiPath: string
  detailPath: string
  
  // 主键字段名（默认为 'id'）
  idField?: string
  
  // Schema 名称（用于动态导入，不直接存储 schema 对象）
  schemaName: string // 例如 'user', 'customer', 'warehouse'
  
  // 字段定义
  fields: Record<string, FieldConfig>
  
  // 列表配置
  list: {
    defaultSort: string
    defaultOrder: 'asc' | 'desc'
    columns: string[] // 要显示的列
    searchFields?: string[] // 可搜索的字段
    pageSize?: number
  }
  
  // 表单字段顺序
  formFields: string[]
  
  // 权限配置
  permissions: {
    list: string[]
    create: string[]
    update: string[]
    delete: string[]
  }
  
  // Prisma 查询配置
  prisma?: {
    model: string
    include?: Record<string, any>
    select?: Record<string, boolean>
  }
}
