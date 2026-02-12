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
  detailPath: '/dashboard/wms/outbound-shipments', // 列表页路径，详情页为 detailPath/[id]
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
      type: 'relation',
      relation: {
        model: 'users',
        displayField: 'full_name',
        valueField: 'id',
      },
      relationField: 'loaded_by', // 指定数据库字段名
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
      searchable: true,
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
    delivery_address: {
      key: 'delivery_address',
      label: '详细地址',
      type: 'textarea',
    },
    contact_name: {
      key: 'contact_name',
      label: '联系人',
      type: 'text',
    },
    contact_phone: {
      key: 'contact_phone',
      label: '电话',
      type: 'text',
    },
    status: {
      key: 'status',
      label: '状态',
      type: 'text',
    },
    requested_start: {
      key: 'requested_start',
      label: '请求开始时间',
      type: 'datetime',
    },
    requested_end: {
      key: 'requested_end',
      label: '请求结束时间',
      type: 'datetime',
    },
    confirmed_end: {
      key: 'confirmed_end',
      label: '确认结束时间',
      type: 'datetime',
    },
    po: {
      key: 'po',
      label: 'PO',
      type: 'text',
    },
    created_at: {
      key: 'created_at',
      label: '创建时间',
      type: 'datetime',
    },
    updated_at: {
      key: 'updated_at',
      label: '更新时间',
      type: 'datetime',
    },
    order_number: {
      key: 'order_number',
      label: '订单号',
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
      'delivery_address',
      'contact_name',
      'contact_phone',
      'notes',
      'status',
      'requested_start',
      'requested_end',
      'confirmed_end',
      'po',
      'order_number',
      'created_at',
      'updated_at',
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
        fields: ['loaded_by_name', 'trailer_code', 'rejected', 'delivery_address', 'contact_name', 'contact_phone', 'notes'],
      },
      delete: {
        enabled: false, // 不允许批量删除
      },
    },
    // 行内编辑配置：允许修改 loaded_by_name, trailer_code, rejected, notes
    inlineEdit: {
      enabled: true,
      fields: ['loaded_by_name', 'trailer_code', 'rejected', 'delivery_address', 'contact_name', 'contact_phone', 'notes'],
    },
  },
  
  formFields: [
    'reference_number', // 预约号码，详情页优先展示
    'trailer_id',
    'loaded_by',
    'delivery_address',
    'contact_name',
    'contact_phone',
    'notes',
    'status',
    'requested_start',
    'requested_end',
    'confirmed_start',
    'confirmed_end',
    'po',
    'order_number',
    'created_at',
    'updated_at',
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
