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
    id: {
      key: 'id',
      label: 'ID',
      type: 'text',
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
    created_at: {
      key: 'created_at',
      label: '创建时间',
      type: 'date',
      sortable: true,
    },
  },
  
  list: {
    defaultSort: 'username',
    defaultOrder: 'asc',
    columns: ['username', 'email', 'full_name', 'role', 'status', 'department', 'created_at'],
    searchFields: ['username', 'email', 'full_name'],
    pageSize: 10,
  },
  
  formFields: ['username', 'email', 'password', 'full_name', 'role', 'status', 'department_id', 'phone'],
  
  permissions: {
    list: ['admin'],
    create: ['admin'],
    update: ['admin'],
    delete: ['admin'],
  },
  
  prisma: {
    model: 'users',
    include: {
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
