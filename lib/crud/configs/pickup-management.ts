/**
 * 提柜管理实体配置
 */

import { EntityConfig } from '../types'

export const pickupManagementConfig: EntityConfig = {
  name: 'pickup_management',
  displayName: '提柜管理',
  pluralName: '提柜管理',
  
  apiPath: '/api/tms/pickup-management',
  detailPath: '/dashboard/tms/pickup-management',
  idField: 'pickup_id',
  
  schemaName: 'pickup_management',
  
  fields: {
    pickup_id: {
      key: 'pickup_id',
      label: '提柜ID',
      type: 'text',
      hidden: true,
    },
    container_number: {
      key: 'container_number',
      label: '柜号',
      type: 'text',
      sortable: true,
      searchable: true,
    },
    mbl: {
      key: 'mbl',
      label: 'MBL',
      type: 'text',
      sortable: true,
      searchable: true,
    },
    port_location: {
      key: 'port_location',
      label: '码头/查验站',
      type: 'location',
      locationType: 'port', // 只显示码头类型的位置
    },
    port_location_id: {
      key: 'port_location_id',
      label: '码头/查验站ID',
      type: 'text',
      hidden: true,
    },
    customer: {
      key: 'customer',
      label: '客户',
      type: 'relation',
      relation: {
        model: 'customers',
        displayField: 'name',
        valueField: 'id',
      },
      sortable: true,
    },
    container_type: {
      key: 'container_type',
      label: '柜型',
      type: 'text',
      sortable: true,
    },
    carrier: {
      key: 'carrier',
      label: '承运公司',
      type: 'relation',
      relation: {
        model: 'carriers',
        displayField: 'name',
        valueField: 'carrier_id',
      },
      relationField: 'carrier_id', // 指定数据库字段名
      sortable: true,
    },
    carrier_id: {
      key: 'carrier_id',
      label: '承运公司ID',
      type: 'text',
      hidden: true,
    },
    do_issued: {
      key: 'do_issued',
      label: 'DO',
      type: 'boolean',
    },
    order_date: {
      key: 'order_date',
      label: '订单日期',
      type: 'date',
      sortable: true,
    },
    eta_date: {
      key: 'eta_date',
      label: 'ETA',
      type: 'date',
      sortable: true,
    },
    operation_mode_display: {
      key: 'operation_mode_display',
      label: '操作方式',
      type: 'text',
    },
    delivery_location: {
      key: 'delivery_location',
      label: '送货地',
      type: 'text',
    },
    lfd_date: {
      key: 'lfd_date',
      label: 'LFD',
      type: 'date',
      sortable: true,
    },
    pickup_date: {
      key: 'pickup_date',
      label: '提柜日期',
      type: 'date',
      sortable: true,
    },
    ready_date: {
      key: 'ready_date',
      label: '就绪日期',
      type: 'date',
      sortable: true,
    },
    return_deadline: {
      key: 'return_deadline',
      label: '还柜日期',
      type: 'date',
      sortable: true,
    },
    warehouse_account: {
      key: 'warehouse_account',
      label: '约仓账号',
      type: 'text',
    },
    earliest_appointment_time: {
      key: 'earliest_appointment_time',
      label: '最早预约时间',
      type: 'datetime',
      sortable: true,
    },
    status: {
      key: 'status',
      label: '状态',
      type: 'badge',
      sortable: true,
      options: [
        { label: '计划中', value: 'planned' },
        { label: '运输中', value: 'in_transit' },
        { label: '已送达', value: 'delivered' },
        { label: '已还柜', value: 'returned' },
      ],
    },
    notes: {
      key: 'notes',
      label: '备注',
      type: 'text',
    },
  },
  
  list: {
    defaultSort: 'created_at',
    defaultOrder: 'desc',
    columns: [
      'container_number',
      'mbl',
      'port_location',
      'customer',
      'container_type',
      'carrier',
      'do_issued',
      'order_date',
      'eta_date',
      'operation_mode_display',
      'delivery_location',
      'lfd_date',
      'pickup_date',
        'ready_date',
        'return_deadline',
      'warehouse_account',
      'earliest_appointment_time',
      'status',
      'notes',
    ],
    searchFields: ['container_number'], // 只搜索柜号（最重要的字段）
    pageSize: 20,
    inlineEdit: {
      enabled: true,
      fields: [
        'port_location',
        'carrier',
        'lfd_date',
        'pickup_date',
        'ready_date',
        'return_deadline',
        'status',
        'notes',
      ],
    },
    batchOperations: {
      enabled: true,
      edit: {
        enabled: true,
        fields: [
          'port_location',
          'carrier',
          'lfd_date',
          'pickup_date',
          'ready_date',
          'return_deadline',
          'status',
          'notes',
        ],
      },
      delete: {
        enabled: false, // 禁用批量删除
      },
    },
    // 筛选配置（快速筛选）- 已自动生成，包含所有 select/relation/date/datetime 字段
    // filterFields 已由 search-config-generator 自动生成
    // 高级搜索配置（多条件组合）- 已自动生成，包含所有 columns 中显示的字段（包括原始字段、读取字段、计算字段）
    // advancedSearchFields 已由 search-config-generator 自动生成
  },
  
  formFields: [],
  
  permissions: {
    list: ['admin', 'tms_manager', 'employee'],
    create: [],
    update: ['admin', 'tms_manager'],
    delete: [],
  },
  
  prisma: undefined,
}

