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
    port_text: {
      key: 'port_text',
      label: '码头位置',
      type: 'text',
    },
    shipping_line: {
      key: 'shipping_line',
      label: '船司',
      type: 'text',
    },
    driver_name: {
      key: 'driver_name',
      label: '司机',
      type: 'text',
      placeholder: '直接填写司机',
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
    },
    container_type: {
      key: 'container_type',
      label: '柜型',
      type: 'select',
      sortable: true,
      options: [
        { label: '40DH', value: '40DH' },
        { label: '45DH', value: '45DH' },
        { label: '40RH', value: '40RH' },
        { label: '45RH', value: '45RH' },
        { label: '20GP', value: '20GP' },
        { label: '其他', value: '其他' },
      ],
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
      type: 'datetime',
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
    current_location: {
      key: 'current_location',
      label: '现在位置',
      type: 'select',
      sortable: true,
      options: [
        { label: '空柜shipper', value: '空柜shipper' },
        { label: '空柜hw', value: '空柜hw' },
        { label: '空柜forest', value: '空柜forest' },
        { label: '空柜私仓', value: '空柜私仓' },
        { label: '满柜shipper', value: '满柜shipper' },
        { label: '满柜hw', value: '满柜hw' },
        { label: '满柜forest', value: '满柜forest' },
        { label: '满柜st', value: '满柜st' },
      ],
    },
    pickup_out: {
      key: 'pickup_out',
      label: '提出',
      type: 'boolean',
      sortable: true,
    },
    report_empty: {
      key: 'report_empty',
      label: '报空',
      type: 'boolean',
      sortable: true,
    },
    return_empty: {
      key: 'return_empty',
      label: '还空',
      type: 'boolean',
      sortable: true,
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
      'port_text',
      'shipping_line',
      'customer',
      'container_type',
      'carrier',
      'driver_name',
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
      'current_location',
      'pickup_out',
      'report_empty',
      'return_empty',
      'notes',
    ],
    searchFields: ['container_number'], // 只搜索柜号（最重要的字段）
    pageSize: 20,
    inlineEdit: {
      enabled: true,
      fields: [
        'container_number',
        'mbl',
        'port_location',
        'port_text',
        'shipping_line',
        'container_type',
        'carrier',
        'driver_name',
        'eta_date',
        'lfd_date',
        'pickup_date',
        'ready_date',
        'return_deadline',
        'current_location',
        'pickup_out',
        'report_empty',
        'return_empty',
        'notes',
      ],
    },
    batchOperations: {
      enabled: true,
      edit: {
        enabled: true,
        fields: [
          'container_number',
          'mbl',
          'port_location',
          'port_text',
          'shipping_line',
          'container_type',
          'carrier',
          'driver_name',
          'eta_date',
          'lfd_date',
          'pickup_date',
          'ready_date',
          'return_deadline',
          'current_location',
          'pickup_out',
          'report_empty',
          'return_empty',
          'notes',
        ],
      },
      delete: {
        enabled: false, // 禁用批量删除
      },
    },
    // 筛选配置：承运公司、司机（司机选项由 API /driver-options 去重后动态加载）
    filterFields: [
      {
        field: 'carrier_id',
        label: '承运公司',
        type: 'select',
        relation: {
          model: 'carriers',
          displayField: 'name',
          valueField: 'carrier_id',
        },
      },
      {
        field: 'driver_name',
        label: '司机',
        type: 'select',
        // 选项由前端 fieldFuzzyLoadOptions.driver_name 从 /api/tms/pickup-management/driver-options 加载
      },
    ],
    // 高级搜索配置（多条件组合）- 已自动生成
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

