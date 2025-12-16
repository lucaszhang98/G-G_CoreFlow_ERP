/**
 * 联系人角色配置（简化版，仅用于关系字段加载）
 */

import { EntityConfig } from '../types'

export const contactRoleConfig: EntityConfig = {
  name: 'contact_role',
  displayName: '联系人',
  pluralName: '联系人',
  
  apiPath: '/api/contact_roles',
  detailPath: '/dashboard/contact_roles',
  idField: 'contact_id',
  
  schemaName: 'contact_role',
  
  fields: {
    contact_id: {
      key: 'contact_id',
      label: '联系人ID',
      type: 'text',
      hidden: true,
    },
    name: {
      key: 'name',
      label: '联系人名称',
      type: 'text',
      required: true,
      sortable: true,
      searchable: true,
    },
    phone: {
      key: 'phone',
      label: '电话',
      type: 'phone',
    },
    email: {
      key: 'email',
      label: '邮箱',
      type: 'email',
    },
    role: {
      key: 'role',
      label: '角色',
      type: 'text',
    },
  },
  
  list: {
    defaultSort: 'contact_id',
    defaultOrder: 'desc',
    columns: ['name', 'phone', 'email', 'role'],
    searchFields: ['name'],
    pageSize: 50,
  },
  
  formFields: ['name', 'phone', 'email', 'role'],
  
  permissions: {
    list: ['admin', 'oms_manager', 'tms_manager', 'wms_manager', 'employee', 'user'],
    create: ['admin', 'oms_manager'],
    update: ['admin', 'oms_manager'],
    delete: ['admin'],
  },
  
  prisma: {
    model: 'contact_roles',
  },
}

