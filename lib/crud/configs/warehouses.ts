/**
 * 仓库管理实体配置（完全可序列化）
 */

import { EntityConfig } from '../types'

export const warehouseConfig: EntityConfig = {
  name: 'warehouse',
  displayName: '仓库',
  pluralName: '仓库',
  
  apiPath: '/api/warehouses',
  detailPath: '/dashboard/warehouses',
  idField: 'warehouse_id',
  
  // Schema 名称，用于动态导入
  schemaName: 'warehouse',
  
  fields: {
    warehouse_id: {
      key: 'warehouse_id',
      label: 'ID',
      type: 'text',
    },
    warehouse_code: {
      key: 'warehouse_code',
      label: '仓库代码',
      type: 'text',
      required: true,
      sortable: true,
      searchable: true,
      placeholder: '请输入仓库代码',
    },
    name: {
      key: 'name',
      label: '仓库名称',
      type: 'text',
      required: true,
      sortable: true,
      searchable: true,
      placeholder: '请输入仓库名称',
    },
    location: {
      key: 'location',
      label: '位置',
      type: 'relation',
      relation: {
        model: 'locations',
        displayField: 'name',
      },
    },
    capacity_cbm: {
      key: 'capacity_cbm',
      label: '容量 (CBM)',
      type: 'number',
    },
    contact_user: {
      key: 'contact_user',
      label: '联系人',
      type: 'relation',
      relation: {
        model: 'users',
        displayField: 'full_name',
      },
    },
    notes: {
      key: 'notes',
      label: '备注',
      type: 'textarea',
      placeholder: '请输入备注（可选）',
    },
    created_at: {
      key: 'created_at',
      label: '创建时间',
      type: 'date',
      sortable: true,
    },
  },
  
  list: {
    defaultSort: 'warehouse_code',
    defaultOrder: 'asc',
    columns: ['warehouse_code', 'name', 'location', 'capacity_cbm', 'contact_user', 'created_at'],
    searchFields: ['warehouse_code', 'name'],
    pageSize: 10,
    // 筛选配置（快速筛选）
    filterFields: [
      {
        field: 'created_at',
        label: '创建日期',
        type: 'dateRange',
        dateFields: ['created_at'],
      },
      {
        field: 'capacity_cbm',
        label: '容量范围',
        type: 'numberRange',
        numberFields: ['capacity_cbm'],
      },
    ],
    // 高级搜索配置（多条件组合）
    advancedSearchFields: [
      {
        field: 'capacity_cbm',
        label: '容量范围 (CBM)',
        type: 'numberRange',
        numberFields: ['capacity_cbm'],
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
  
  formFields: ['warehouse_code', 'name', 'location_id', 'capacity_cbm', 'contact_user_id', 'notes'],
  
  permissions: {
    list: ['admin', 'oms_manager', 'tms_manager', 'wms_manager', 'employee', 'user'],
    create: ['admin', 'wms_manager'],
    update: ['admin', 'wms_manager'],
    delete: ['admin'],
  },
  
  prisma: {
    model: 'warehouses',
    include: {
      locations: {
        select: {
          location_id: true,
          name: true,
          address_line1: true,
          city: true,
        },
      },
      users_warehouses_contact_user_idTousers: {
        select: {
          id: true,
          full_name: true,
        },
      },
    },
  },
}
