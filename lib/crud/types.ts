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
  | 'datetime'
  | 'checkbox'
  | 'boolean' // boolean 类型（使用图标显示）
  | 'location' // 位置选择（两级下拉框：类型 + 代码）

/**
 * 筛选字段配置（完全可序列化）
 */
export interface FilterFieldConfig {
  field: string // 字段名
  label: string // 显示标签
  type: 'select' | 'checkbox' | 'dateRange' | 'numberRange' // 筛选类型
  options?: { label: string; value: string }[] // select 类型使用（静态选项）
  loadOptions?: () => Promise<Array<{ label: string; value: string }>> // select 类型使用（动态加载选项）
  relation?: { // 关系字段（从关联表获取选项）
    model: string
    displayField: string
    valueField?: string
  }
  // dateRange 类型：指定要筛选的日期字段
  dateFields?: string[]
  // numberRange 类型：指定要筛选的数值字段
  numberFields?: string[]
}

/**
 * 高级搜索字段配置（完全可序列化）
 */
export interface AdvancedSearchFieldConfig {
  field: string // 字段名
  label: string // 显示标签
  type: 'text' | 'number' | 'date' | 'datetime' | 'select' | 'numberRange' | 'dateRange'
  options?: { label: string; value: string }[] // select 类型使用
  relation?: { // 关系字段
    model: string
    displayField: string
    valueField?: string
  }
  // numberRange 类型：指定要筛选的数值字段
  numberFields?: string[]
  // dateRange 类型：指定要筛选的日期字段
  dateFields?: string[]
}

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
  hidden?: boolean // 标记为隐藏字段（如审计字段），不在前端显示
  readonly?: boolean // 标记为只读字段，用户不能编辑
  computed?: boolean // 标记为计算字段，由系统自动计算
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
    columns: string[] // 要显示的列（如果使用自定义列，这个可以留空）
    searchFields?: string[] // 可搜索的字段（简单搜索）
    pageSize?: number
    customColumns?: any // 自定义列定义（ColumnDef[]），如果提供则使用自定义列而不是自动生成
    // 筛选配置（快速筛选，在搜索框旁边显示）
    filterFields?: FilterFieldConfig[]
    // 高级搜索配置（弹窗，多条件组合）
    advancedSearchFields?: AdvancedSearchFieldConfig[]
    // 批量操作配置
    batchOperations?: {
      enabled?: boolean // 是否启用批量操作（默认 true）
      edit?: {
        enabled: boolean // 是否启用批量编辑
        fields?: string[] // 可批量编辑的字段列表（如果为空，则所有可更新字段都可批量编辑）
      }
      delete?: {
        enabled: boolean // 是否启用批量删除
      }
    }
    // 行内编辑配置
    inlineEdit?: {
      enabled?: boolean // 是否启用行内编辑（默认 true，如果有 update 权限）
      fields?: string[] // 可编辑的字段列表（如果为空，则所有可更新字段都可编辑）
    }
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
