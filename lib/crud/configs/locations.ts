/**
 * 位置管理实体配置（完全可序列化）
 */

import { EntityConfig } from '../types'

export const locationConfig: EntityConfig = {
  name: 'location',
  displayName: '位置',
  pluralName: '位置',
  
  apiPath: '/api/locations',
  detailPath: '/dashboard/settings/locations',
  idField: 'location_id',
  
  // Schema 名称，用于动态导入
  schemaName: 'location',
  
  fields: {
    location_id: {
      key: 'location_id',
      label: 'ID',
      type: 'text',
    },
    location_code: {
      key: 'location_code',
      label: '位置代码',
      type: 'text',
      sortable: true,
      searchable: true,
      placeholder: '请输入位置代码（可选）',
    },
    name: {
      key: 'name',
      label: '位置名称',
      type: 'text',
      required: true,
      sortable: true,
      searchable: true,
      placeholder: '请输入位置名称',
    },
    location_type: {
      key: 'location_type',
      label: '位置类型',
      type: 'select',
      sortable: true,
      options: [
        { label: '收货地址', value: 'delivery' },
        { label: '发货地址', value: 'pickup' },
        { label: '中转站', value: 'transit' },
        { label: '码头', value: 'port' },
        { label: '查验站', value: 'inspection' },
        { label: '仓库', value: 'warehouse' },
      ],
    },
    city: {
      key: 'city',
      label: '城市',
      type: 'text',
      searchable: true,
      placeholder: '请输入城市',
    },
    country: {
      key: 'country',
      label: '国家',
      type: 'text',
      searchable: true,
      placeholder: '请输入国家',
    },
    address_line1: {
      key: 'address_line1',
      label: '地址行1',
      type: 'text',
      placeholder: '请输入地址行1（可选）',
    },
    address_line2: {
      key: 'address_line2',
      label: '地址行2',
      type: 'text',
      placeholder: '请输入地址行2（可选）',
    },
    state: {
      key: 'state',
      label: '州/省',
      type: 'text',
      placeholder: '请输入州/省（可选）',
    },
    postal_code: {
      key: 'postal_code',
      label: '邮编',
      type: 'text',
      placeholder: '请输入邮编（可选）',
    },
    timezone: {
      key: 'timezone',
      label: '时区',
      type: 'text',
      placeholder: '请输入时区（可选）',
    },
    latitude: {
      key: 'latitude',
      label: '纬度',
      type: 'number',
      placeholder: '请输入纬度（可选）',
    },
    longitude: {
      key: 'longitude',
      label: '经度',
      type: 'number',
      placeholder: '请输入经度（可选）',
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
    defaultSort: 'location_code',
    defaultOrder: 'asc',
    columns: ['location_code', 'name', 'location_type', 'city', 'country', 'created_at'],
    searchFields: ['location_code', 'name', 'city', 'country'],
    pageSize: 10,
    // 筛选配置（快速筛选）
    filterFields: [
      {
        field: 'location_type',
        label: '位置类型',
        type: 'select',
        options: [
          { label: '收货地址', value: 'delivery' },
          { label: '发货地址', value: 'pickup' },
          { label: '中转站', value: 'transit' },
          { label: '码头', value: 'port' },
          { label: '查验站', value: 'inspection' },
          { label: '仓库', value: 'warehouse' },
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
        field: 'city',
        label: '城市',
        type: 'text',
      },
      {
        field: 'country',
        label: '国家',
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
  
  formFields: ['location_code', 'name', 'location_type', 'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country', 'timezone', 'latitude', 'longitude', 'notes'],
  
  permissions: {
    list: ['admin', 'oms_manager', 'tms_manager', 'wms_manager', 'employee', 'user'],
    create: ['admin', 'oms_manager', 'tms_manager'],
    update: ['admin', 'oms_manager', 'tms_manager'],
    delete: ['admin'],
  },
  
  prisma: {
    model: 'locations',
  },
}

