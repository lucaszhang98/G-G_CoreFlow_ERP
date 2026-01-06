/**
 * 出库管理实体配置（完全可序列化）
 * 
 * 注意：出库管理现在从 delivery_appointments 动态获取数据（非直送）
 * 每个 delivery_appointment 可能有一个对应的 outbound_shipment 记录
 * 只能修改 trailer_id, loaded_by, notes
 */

import { EntityConfig } from '../types'

export const outboundShipmentConfig: EntityConfig = {
  name: 'outbound_shipments',
  displayName: '出库',
  pluralName: '出库',
  
  apiPath: '/api/wms/outbound-shipments',
  detailPath: '/dashboard/wms/outbound-shipments',
  idField: 'appointment_id', // 使用 appointment_id 作为主键（因为列表显示的是 delivery_appointments）
  
  // Schema 名称，用于动态导入
  schemaName: 'outbound_shipment',
  
  fields: {
    appointment_id: {
      key: 'appointment_id',
      label: '预约ID',
      type: 'text',
      hidden: true, // 隐藏，但作为主键使用
    },
    reference_number: {
      key: 'reference_number',
      label: '预约号码',
      type: 'text',
      sortable: true,
      searchable: true,
    },
    delivery_method: {
      key: 'delivery_method',
      label: '派送方式',
      type: 'text',
      sortable: true,
      searchable: true,
    },
    rejected: {
      key: 'rejected',
      label: '拒收',
      type: 'boolean',
      sortable: true,
    },
    appointment_account: {
      key: 'appointment_account',
      label: '预约账号',
      type: 'text',
      sortable: true,
      searchable: true,
    },
    appointment_type: {
      key: 'appointment_type',
      label: '预约类型',
      type: 'text',
      sortable: true,
    },
    loaded_by_name: {
      key: 'loaded_by_name',
      label: '装车人',
      type: 'text',
      sortable: true,
    },
    origin_location: {
      key: 'origin_location',
      label: '起始地',
      type: 'location',
    },
    trailer_code: {
      key: 'trailer_code',
      label: 'Trailer',
      type: 'text',
      sortable: true,
    },
    confirmed_start: {
      key: 'confirmed_start',
      label: '送货时间',
      type: 'datetime',
      sortable: true,
    },
    destination_location: {
      key: 'destination_location',
      label: '目的地',
      type: 'location',
    },
    total_pallets: {
      key: 'total_pallets',
      label: '板数',
      type: 'number',
      sortable: true,
    },
    notes: {
      key: 'notes',
      label: '备注',
      type: 'text',
    },
    // 隐藏字段：outbound_shipment_id, trailer_id, loaded_by
    outbound_shipment_id: {
      key: 'outbound_shipment_id',
      label: '出库ID',
      type: 'text',
      hidden: true,
    },
    trailer_id: {
      key: 'trailer_id',
      label: 'Trailer ID',
      type: 'number',
      hidden: true,
    },
    loaded_by: {
      key: 'loaded_by',
      label: '装车人ID',
      type: 'number',
      hidden: true,
    },
  },
  
  list: {
    defaultSort: 'created_at',
    defaultOrder: 'desc',
    columns: [
      'reference_number',
      'delivery_method',
      'rejected',
      'appointment_account',
      'appointment_type',
      'loaded_by_name',
      'origin_location',
      'trailer_code',
      'confirmed_start',
      'destination_location',
      'total_pallets',
      'notes',
    ],
    searchFields: ['reference_number'], // 只搜索预约号码（最重要的字段）
    // 筛选配置（快速筛选）- 已自动生成，包含所有 select/relation/date/datetime 字段
    // filterFields 已由 search-config-generator 自动生成
    // 高级搜索配置（多条件组合）- 已自动生成，包含所有 columns 中显示的字段（包括原始字段、读取字段、计算字段）
    // advancedSearchFields 已由 search-config-generator 自动生成
    // 批量操作配置：只允许批量修改 trailer_id, loaded_by, notes
    batchOperations: {
      enabled: true,
      edit: {
        enabled: true,
        fields: ['trailer_id', 'loaded_by', 'notes'],
      },
      delete: {
        enabled: false, // 不允许批量删除
      },
    },
    // 行内编辑配置：只允许修改 trailer_id, loaded_by, notes
    inlineEdit: {
      enabled: true,
      fields: ['trailer_id', 'loaded_by', 'notes'],
    },
  },
  
  formFields: [
    'trailer_id',
    'loaded_by',
    'notes',
  ],
  
  permissions: {
    list: ['admin', 'oms_manager', 'tms_manager', 'wms_manager', 'employee', 'user'],
    create: [], // WMS 模块不允许手动创建
    update: ['admin', 'wms_manager'],
    delete: [], // WMS 模块不允许删除
  },
  
  // 注意：由于数据来自 delivery_appointments，这里不需要 prisma.include
  // API 会直接查询 delivery_appointments
  prisma: {
    model: 'delivery_appointments', // 实际上查询的是 delivery_appointments
  },
}
