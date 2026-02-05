/**
 * OMS 订单明细实体配置（完全可序列化）
 * 用于显示所有订单明细（已入库 + 未入库）
 */

import { EntityConfig } from '../types'

export const orderDetailConfig: EntityConfig = {
  name: 'order_detail',
  displayName: '订单明细',
  pluralName: '订单明细',
  
  apiPath: '/api/oms/order-details',
  detailPath: '/dashboard/oms/order-details',
  idField: 'id',
  
  // Schema 名称，用于动态导入
  schemaName: 'order_detail',
  
  fields: {
    id: {
      key: 'id',
      label: 'ID',
      type: 'text',
    },
    order_id: {
      key: 'order_id',
      label: '订单ID',
      type: 'text',
    },
    order_number: {
      key: 'order_number',
      label: '订单号',
      type: 'text',
      sortable: true,
      searchable: true,
    },
    customer_name: {
      key: 'customer_name',
      label: '客户',
      type: 'text',
      searchable: true,
    },
    container_number: {
      key: 'container_number',
      label: '柜号',
      type: 'text',
      searchable: true,
    },
    planned_unload_at: {
      key: 'planned_unload_at',
      label: '预计拆柜日期',
      type: 'date',
      sortable: true,
    },
    delivery_location_code: {
      key: 'delivery_location_code',
      label: '仓点',
      type: 'location',
      searchable: true,
    },
    delivery_nature: {
      key: 'delivery_nature',
      label: '送仓性质',
      type: 'select',
      sortable: true,
      options: [
        { label: 'AMZ', value: 'AMZ' },
        { label: '扣货', value: '扣货' },
        { label: '已放行', value: '已放行' },
        { label: '私仓', value: '私仓' },
        { label: '转仓', value: '转仓' },
      ],
    },
    estimated_pallets: {
      key: 'estimated_pallets',
      label: '预估板数',
      type: 'number',
      sortable: true,
    },
    actual_pallets: {
      key: 'actual_pallets',
      label: '实际板数',
      type: 'number',
      sortable: false, // 计算字段，不支持排序
    },
    remaining_pallets: {
      key: 'remaining_pallets',
      label: '剩余板数',
      type: 'number',
      sortable: false, // 计算字段，不支持排序
    },
    unbooked_pallets: {
      key: 'unbooked_pallets',
      label: '未约板数',
      type: 'number',
      sortable: false, // 计算字段，不支持排序
    },
    storage_location_code: {
      key: 'storage_location_code',
      label: '仓库位置',
      type: 'text',
      sortable: false, // 关联字段，不支持排序
      searchable: true,
    },
    notes: {
      key: 'notes',
      label: '备注',
      type: 'textarea',
    },
    window_period: {
      key: 'window_period',
      label: '窗口期',
      type: 'text',
      searchable: false,
    },
    delivery_progress: {
      key: 'delivery_progress',
      label: '送货进度',
      type: 'number',
      sortable: false,
    },
    earliest_appointment_reference_number: {
      key: 'earliest_appointment_reference_number',
      label: '最早预约号码',
      type: 'text',
      sortable: false,
    },
    earliest_appointment_time: {
      key: 'earliest_appointment_time',
      label: '最早预约时间',
      type: 'datetime',
      sortable: false,
    },
  },
  
  list: {
    defaultSort: 'created_at',
    defaultOrder: 'desc',
    columns: [
      'container_number',
      'customer_name',
      'delivery_location_code',
      'delivery_nature',
      'planned_unload_at',
      'estimated_pallets',
      'actual_pallets',
      'unbooked_pallets',
      'remaining_pallets',
      'earliest_appointment_reference_number',
      'earliest_appointment_time',
      'storage_location_code',
      'notes',
      'delivery_progress',
    ],
    searchFields: ['container_number', 'order_number'],
    pageSize: 20,
    // 筛选配置
    filterFields: [
      {
        field: 'delivery_nature',
        label: '送仓性质',
        type: 'select',
        options: [
          { label: 'AMZ', value: 'AMZ' },
          { label: '扣货', value: '扣货' },
          { label: '已放行', value: '已放行' },
          { label: '私仓', value: '私仓' },
          { label: '转仓', value: '转仓' },
        ],
      },
      {
        field: 'delivery_location_code',
        label: '仓点',
        type: 'select',
        relation: {
          model: 'locations',
          displayField: 'location_code',
          valueField: 'location_id',
        },
      },
      {
        field: 'planned_unload_at',
        label: '预计拆柜日期',
        type: 'dateRange',
        dateFields: ['planned_unload_at'],
      },
      {
        field: 'booking_status',
        label: '预约状态',
        type: 'select',
        options: [
          { label: '未约', value: 'unbooked' }, // remaining_pallets > 0
          { label: '约满', value: 'fully_booked' }, // remaining_pallets = 0
          { label: '超约', value: 'overbooked' }, // remaining_pallets < 0
        ],
      },
    ],
  },
  
  formFields: [],
  
  permissions: {
    list: ['admin', 'oms_manager', 'tms_manager', 'wms_manager', 'employee', 'user'],
    create: [],
    update: [],
    delete: [],
  },
  
  prisma: {
    model: 'order_detail',
  },
}

