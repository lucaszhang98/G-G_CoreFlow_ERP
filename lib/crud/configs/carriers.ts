/**
 * 承运商管理实体配置（完全可序列化）
 */

import { EntityConfig } from '../types'

export const carrierConfig: EntityConfig = {
  name: 'carrier',
  displayName: '承运商',
  pluralName: '承运商',
  
  apiPath: '/api/carriers',
  detailPath: '/dashboard/settings/carriers',
  idField: 'carrier_id',
  
  // Schema 名称，用于动态导入
  schemaName: 'carrier',
  
  fields: {
    carrier_id: {
      key: 'carrier_id',
      label: 'ID',
      type: 'text',
    },
    carrier_code: {
      key: 'carrier_code',
      label: '承运商代码',
      type: 'text',
      sortable: true,
      searchable: true,
      placeholder: '请输入承运商代码（可选）',
    },
    name: {
      key: 'name',
      label: '承运商名称',
      type: 'text',
      required: true,
      sortable: true,
      searchable: true,
      placeholder: '请输入承运商名称',
    },
    carrier_type: {
      key: 'carrier_type',
      label: '承运商类型',
      type: 'text',
      searchable: true,
      placeholder: '请输入承运商类型（可选）',
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
    defaultSort: 'carrier_code',
    defaultOrder: 'asc',
    columns: ['carrier_code', 'name', 'carrier_type', 'contact', 'created_at'],
    searchFields: ['carrier_code', 'name'],
    pageSize: 10,
    // 筛选配置（快速筛选）
    filterFields: [
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
        field: 'carrier_type',
        label: '承运商类型',
        type: 'text',
      },
      {
        field: 'created_at',
        label: '创建日期',
        type: 'dateRange',
        dateFields: ['created_at'],
      },
    ],
    // 批量操作配置
    batchOperations: {
      enabled: true,
      edit: {
        enabled: true,
      },
      delete: {
        enabled: true,
      },
    },
    // 行内编辑配置
    inlineEdit: {
      enabled: true,
    },
  },
  
  formFields: ['carrier_code', 'name', 'carrier_type', 'contact'],
  
  permissions: {
    list: ['admin', 'oms_manager', 'tms_manager', 'wms_manager', 'employee', 'user'],
    create: ['admin', 'tms_manager'],
    update: ['admin', 'tms_manager'],
    delete: ['admin'],
  },
  
  prisma: {
    model: 'carriers',
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

