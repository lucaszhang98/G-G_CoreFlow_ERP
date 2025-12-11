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
      placeholder: '请输入司机代码',
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
      placeholder: '请输入驾驶证号',
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
      placeholder: '请输入驾驶证到期日',
    },
    notes: {
      key: 'notes',
      label: '备注',
      type: 'textarea',
      placeholder: '请输入备注',
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
    searchFields: ['driver_code'], // 只搜索司机代码（最重要的字段）
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

