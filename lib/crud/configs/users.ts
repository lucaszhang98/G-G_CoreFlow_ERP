/**
 * 用户管理实体配置（完全可序列化）
 */

import { EntityConfig } from '../types'

export const userConfig: EntityConfig = {
  name: 'user',
  displayName: '用户',
  pluralName: '用户',
  
  apiPath: '/api/users',
  detailPath: '/dashboard/users',
  
  // Schema 名称，用于动态导入
  schemaName: 'user',
  
  fields: {
    // id 是审计字段，由数据库自动生成，不在前端显示
    id: {
      key: 'id',
      label: 'ID',
      type: 'text',
      hidden: true,
    },
    username: {
      key: 'username',
      label: '用户名',
      type: 'text',
      required: true,
      sortable: true,
      searchable: true,
      placeholder: '请输入用户名',
    },
    email: {
      key: 'email',
      label: '邮箱',
      type: 'email',
      required: true,
      searchable: true,
      placeholder: '请输入邮箱',
    },
    full_name: {
      key: 'full_name',
      label: '姓名',
      type: 'text',
      searchable: true,
      placeholder: '请输入姓名',
    },
    role: {
      key: 'role',
      label: '角色',
      type: 'select',
      sortable: true,
      options: [
        { label: '管理员', value: 'admin' },
        { label: 'OMS经理', value: 'oms_manager' },
        { label: 'TMS经理', value: 'tms_manager' },
        { label: 'WMS经理', value: 'wms_manager' },
        { label: '员工', value: 'employee' },
        { label: '用户', value: 'user' },
      ],
    },
    status: {
      key: 'status',
      label: '状态',
      type: 'select',
      sortable: true,
      options: [
        { label: '活跃', value: 'active' },
        { label: '停用', value: 'inactive' },
      ],
    },
    department: {
      key: 'department',
      label: '部门',
      type: 'relation',
      relation: {
        model: 'departments',
        displayField: 'name',
      },
    },
    phone: {
      key: 'phone',
      label: '电话',
      type: 'phone',
      placeholder: '请输入电话',
    },
    password: {
      key: 'password',
      label: '密码',
      type: 'text',
      required: false, // 更新时可选
      placeholder: '请输入密码（留空则不修改）',
    },
    // created_at 是审计字段，由系统自动维护，不在前端显示
    created_at: {
      key: 'created_at',
      label: '创建时间',
      type: 'date',
      sortable: true,
      hidden: true,
    },
  },
  
  list: {
    defaultSort: 'username',
    defaultOrder: 'asc',
    columns: ['username', 'email', 'full_name', 'role', 'status', 'department'],
    searchFields: ['username'], // 只搜索用户名（最重要的字段）
    pageSize: 10,
    // 筛选配置（快速筛选）- 已自动生成，包含所有 select/relation/date/datetime 字段
    // filterFields 已由 search-config-generator 自动生成
    // 高级搜索配置（多条件组合）- 已自动生成，包含所有 columns 中显示的字段（包括原始字段、读取字段、计算字段）
    // advancedSearchFields 已由 search-config-generator 自动生成
    // 批量操作配置
    batchOperations: {
      enabled: true,
      edit: {
        enabled: true,
        fields: ['role', 'status'],
      },
      delete: {
        enabled: true,
      },
    },
    // 行内编辑配置
    inlineEdit: {
      enabled: true,
      fields: ['role', 'status', 'full_name'],
    },
  },
  
  formFields: ['username', 'email', 'password', 'full_name', 'role', 'status', 'department_id', 'phone'],
  
  permissions: {
    list: ['admin', 'oms_manager', 'tms_manager', 'wms_manager', 'employee', 'user'], // 允许所有登录用户查看用户列表（用于关系字段）
    create: ['admin'],
    update: ['admin'],
    delete: ['admin'],
  },
  
  prisma: {
    model: 'users',
    // 使用 select 而不是 include，避免与排序和查询条件的冲突
    select: {
      id: true,
      username: true,
      email: true,
      full_name: true,
      role: true,
      status: true,
      phone: true,
      avatar_url: true,
      created_at: true,
      updated_at: true,
      created_by: true,
      updated_by: true,
      department_id: true,
      departments_users_department_idTodepartments: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  },
}
