/**
 * 司机管理实体配置（完全可序列化）
 */

import { EntityConfig } from '../types'

export const driverConfig: EntityConfig = {
  name: 'driver',
  displayName: '司机',
  pluralName: '司机',
  
  apiPath: '/api/drivers',
  detailPath: '/dashboard/settings/drivers',
  idField: 'driver_id',
  
  // Schema 名称，用于动态导入
  schemaName: 'driver',
  
  fields: {
    driver_id: {
      key: 'driver_id',
      label: 'ID',
      type: 'text',
    },
    driver_code: {
      key: 'driver_code',
      label: '司机代码',
      type: 'text',
      sortable: true,
      searchable: true,
      placeholder: '请输入司机代码（可选）',
    },
    carrier: {
      key: 'carrier',
      label: '承运商',
      type: 'relation',
      relation: {
        model: 'carriers',
        displayField: 'name',
        valueField: 'carrier_id',
      },
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
    license_number: {
      key: 'license_number',
      label: '驾驶证号',
      type: 'text',
      searchable: true,
      placeholder: '请输入驾驶证号（可选）',
    },
    status: {
      key: 'status',
      label: '状态',
      type: 'badge',
      sortable: true,
      options: [
        { label: '可用', value: 'active' },
        { label: '停用', value: 'inactive' },
      ],
    },
    license_expiration: {
      key: 'license_expiration',
      label: '驾驶证到期日',
      type: 'date',
      placeholder: '请输入驾驶证到期日（可选）',
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
    defaultSort: 'driver_code',
    defaultOrder: 'asc',
    columns: ['driver_code', 'carrier', 'contact', 'license_number', 'status', 'created_at'],
    searchFields: ['driver_code', 'license_number'],
    pageSize: 10,
    // 筛选配置（快速筛选）
    filterFields: [
      {
        field: 'status',
        label: '状态',
        type: 'select',
        options: [
          { label: '可用', value: 'active' },
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
        field: 'license_number',
        label: '驾驶证号',
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
        fields: ['status'],
      },
      delete: {
        enabled: true,
      },
    },
    // 行内编辑配置
    inlineEdit: {
      enabled: true,
      fields: ['status'],
    },
  },
  
  formFields: ['driver_code', 'license_number', 'license_expiration', 'status', 'carrier_id', 'contact', 'notes'],
  
  permissions: {
    list: ['admin', 'oms_manager', 'tms_manager', 'wms_manager', 'employee', 'user'],
    create: ['admin', 'tms_manager'],
    update: ['admin', 'tms_manager'],
    delete: ['admin'],
  },
  
  prisma: {
    model: 'drivers',
    include: {
      carriers: {
        select: {
          carrier_id: true,
          name: true,
          carrier_code: true,
        },
      },
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

