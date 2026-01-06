/**
 * 送仓管理实体配置
 */

import { EntityConfig } from '../types'

export const deliveryManagementConfig: EntityConfig = {
  name: 'delivery_management',
  displayName: '送仓管理',
  pluralName: '送仓管理',
  
  apiPath: '/api/tms/delivery-management',
  detailPath: '/dashboard/tms/delivery-management',
  idField: 'delivery_id',
  
  schemaName: 'delivery_management',
  
  fields: {
    delivery_id: {
      key: 'delivery_id',
      label: '送仓ID',
      type: 'text',
      hidden: true,
    },
    appointment_number: {
      key: 'appointment_number',
      label: '预约号码',
      type: 'text',
      sortable: true,
      searchable: true,
    },
    container_number: {
      key: 'container_number',
      label: '柜号',
      type: 'text',
      sortable: true,
    },
    delivery_date: {
      key: 'delivery_date',
      label: '送货日期',
      type: 'datetime',
      sortable: true,
    },
    origin_location: {
      key: 'origin_location',
      label: '起始地',
      type: 'location',
    },
    destination_location: {
      key: 'destination_location',
      label: '目的地',
      type: 'location',
    },
    po: {
      key: 'po',
      label: 'PO',
      type: 'text',
      sortable: true,
      searchable: true,
    },
    pallet_type: {
      key: 'pallet_type',
      label: '预约类型',
      type: 'text',
    },
    delivery_method: {
      key: 'delivery_method',
      label: '派送方式',
      type: 'badge',
    },
    warehouse_account: {
      key: 'warehouse_account',
      label: '约仓账号',
      type: 'text',
    },
    appointment_time: {
      key: 'appointment_time',
      label: '预约时间',
      type: 'datetime',
      sortable: true,
    },
    driver_name: {
      key: 'driver_name',
      label: '送仓司机',
      type: 'relation',
      relation: {
        model: 'drivers',
        displayField: 'name',
        valueField: 'driver_id',
      },
      // 关系字段不应该在 searchFields 中，应该通过筛选来搜索
    },
    driver_id: {
      key: 'driver_id',
      label: '送仓司机ID',
      type: 'text',
      hidden: true,
    },
    rejected: {
      key: 'rejected',
      label: '拒收',
      type: 'badge',
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
      'appointment_number',
      'container_number',
      'delivery_date',
      'origin_location',
      'destination_location',
      'po',
      'pallet_type',
      'delivery_method',
      'warehouse_account',
      'appointment_time',
      'driver_name',
      'rejected',
      'status',
      'notes',
    ],
    searchFields: ['appointment_number'], // 只搜索预约号码（最重要的字段）
    pageSize: 20,
    inlineEdit: {
      enabled: true,
      fields: [
        'driver_name',
        'status',
        'notes',
      ],
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

