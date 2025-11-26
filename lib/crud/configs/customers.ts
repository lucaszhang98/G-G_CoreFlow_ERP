/**
 * 客户管理实体配置（完全可序列化）
 */

import { EntityConfig } from '../types'

export const customerConfig: EntityConfig = {
  name: 'customer',
  displayName: '客户',
  pluralName: '客户',
  
  apiPath: '/api/customers',
  detailPath: '/dashboard/customers',
  
  // Schema 名称，用于动态导入
  schemaName: 'customer',
  
  fields: {
    id: {
      key: 'id',
      label: 'ID',
      type: 'text',
    },
    code: {
      key: 'code',
      label: '客户代码',
      type: 'text',
      required: true,
      sortable: true,
      searchable: true,
      placeholder: '请输入客户代码',
    },
    name: {
      key: 'name',
      label: '客户名称',
      type: 'text',
      required: true,
      sortable: true,
      searchable: true,
      placeholder: '请输入客户名称',
    },
    company_name: {
      key: 'company_name',
      label: '公司名称',
      type: 'text',
      searchable: true,
      placeholder: '请输入公司名称（可选）',
    },
    status: {
      key: 'status',
      label: '状态',
      type: 'badge',
      sortable: true,
      options: [
        { label: '活跃', value: 'active' },
        { label: '停用', value: 'inactive' },
      ],
    },
    credit_limit: {
      key: 'credit_limit',
      label: '信用额度',
      type: 'currency',
    },
    contact: {
      key: 'contact',
      label: '联系人',
      type: 'relation',
      relation: {
        model: 'contact_roles',
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
    defaultSort: 'code',
    defaultOrder: 'asc',
    columns: ['code', 'name', 'company_name', 'status', 'credit_limit', 'contact', 'created_at'],
    searchFields: ['code', 'name', 'company_name'],
    pageSize: 10,
    // 筛选配置（快速筛选）
    filterFields: [
      {
        field: 'status',
        label: '状态',
        type: 'select',
        options: [
          { label: '活跃', value: 'active' },
          { label: '停用', value: 'inactive' },
        ],
      },
      {
        field: 'created_at',
        label: '创建日期',
        type: 'dateRange',
        dateFields: ['created_at'],
      },
    ],
    // 高级搜索配置（多条件组合）
    advancedSearchFields: [
      {
        field: 'contact',
        label: '联系人',
        type: 'text',
      },
      {
        field: 'credit_limit',
        label: '信用额度',
        type: 'numberRange',
        numberFields: ['credit_limit'],
      },
    ],
    // 批量操作配置
    batchOperations: {
      enabled: true,
      edit: {
        enabled: true,
        fields: ['status', 'credit_limit'], // 可批量编辑的字段
      },
      delete: {
        enabled: true,
      },
    },
    // 行内编辑配置
    inlineEdit: {
      enabled: true,
      fields: ['status', 'credit_limit', 'company_name'], // 可编辑的字段
    },
  },
  
  formFields: ['code', 'name', 'company_name', 'status', 'credit_limit', 'contact'],
  
  permissions: {
    list: ['admin', 'oms_manager', 'tms_manager', 'wms_manager', 'employee', 'user'],
    create: ['admin', 'oms_manager'],
    update: ['admin', 'oms_manager'],
    delete: ['admin'],
  },
  
  prisma: {
    model: 'customers',
    include: {
      contact_roles: {
        select: {
          contact_id: true,
          name: true,
          phone: true,
          email: true,
        },
      },
    },
  },
}
