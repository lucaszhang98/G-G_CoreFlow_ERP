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
      required: true,
      sortable: true,
      searchable: true,
      placeholder: '请输入位置代码',
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
      required: true,
      sortable: true,
      options: [
        { label: '码头/查验站', value: 'port' },
        { label: '亚马逊', value: 'amazon' },
        { label: '仓库', value: 'warehouse' },
      ],
    },
    city: {
      key: 'city',
      label: '城市',
      type: 'text',
      searchable: true,
      placeholder: '请输入城市（可选）',
    },
    country: {
      key: 'country',
      label: '国家',
      type: 'text',
      searchable: true,
      placeholder: '请输入国家（可选）',
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
      computed: true,
      readonly: true,
      placeholder: '自动计算',
    },
    latitude: {
      key: 'latitude',
      label: '纬度',
      type: 'number',
      computed: true,
      readonly: true,
      placeholder: '自动计算',
    },
    longitude: {
      key: 'longitude',
      label: '经度',
      type: 'number',
      computed: true,
      readonly: true,
      placeholder: '自动计算',
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
    columns: ['location_code', 'name', 'location_type', 'notes', 'created_at'],
    searchFields: ['location_code', 'name'], // 支持按代码、名称模糊搜索
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
        // 批量编辑字段：只包含主页面字段和详细信息字段，排除自动计算字段
        fields: ['location_code', 'name', 'location_type', 'notes', 'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country'],
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
  
  // 主页面字段：location_code, name, location_type, notes
  // 详细信息字段：address_line1, address_line2, city, state, postal_code, country
  // 自动计算字段（不在表单中显示）：timezone, latitude, longitude
  formFields: ['location_code', 'name', 'location_type', 'notes', 'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country'],
  
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

