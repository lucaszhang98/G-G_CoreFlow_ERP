/**
 * 预约管理实体配置（完全可序列化）
 */

import { EntityConfig } from '../types'
import {
  DELIVERY_APPOINTMENT_ACCOUNT_SELECT_OPTIONS,
  DELIVERY_APPOINTMENT_TYPE_SELECT_OPTIONS,
} from '../delivery-appointment-shared-selects'

export const deliveryAppointmentConfig: EntityConfig = {
  name: 'delivery_appointments',
  displayName: '预约',
  pluralName: '预约',
  
  apiPath: '/api/oms/appointments',
  detailPath: '/dashboard/oms/appointments',
  idField: 'appointment_id',
  
  // Schema 名称，用于动态导入
  schemaName: 'delivery_appointment',
  
  fields: {
    // appointment_id 是审计字段，由数据库自动生成，不在前端显示
    appointment_id: {
      key: 'appointment_id',
      label: 'ID',
      type: 'text',
      hidden: true,
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
      type: 'select',
      sortable: true,
      searchable: true,
      options: [
        { label: '私仓', value: '私仓' },
        { label: '自提', value: '自提' },
        { label: '直送', value: '直送' },
        { label: '卡派', value: '卡派' },
      ],
    },
    appointment_account: {
      key: 'appointment_account',
      label: '预约账号',
      type: 'select',
      sortable: true,
      searchable: true,
      options: DELIVERY_APPOINTMENT_ACCOUNT_SELECT_OPTIONS,
    },
    appointment_type: {
      key: 'appointment_type',
      label: '预约类型',
      type: 'select',
      sortable: true,
      options: DELIVERY_APPOINTMENT_TYPE_SELECT_OPTIONS,
    },
    origin_location: {
      key: 'origin_location',
      label: '起始地',
      type: 'location',
      required: false, // 起始地改为非必填
      locationType: 'warehouse', // 默认位置类型为仓库（GG 是仓库类型）
    },
    destination_location: {
      key: 'destination_location',
      label: '目的地',
      type: 'location',
    },
    confirmed_start: {
      key: 'confirmed_start',
      label: '送货时间',
      type: 'datetime',
      sortable: true,
    },
    eta: {
      key: 'eta',
      label: 'ETA',
      type: 'date',
      sortable: false,
      readonly: true,
      computed: true,
    },
    total_pallets: {
      key: 'total_pallets',
      label: '板数',
      type: 'number',
      sortable: true,
    },
    rejected: {
      key: 'rejected',
      label: '拒收',
      type: 'boolean',
      sortable: true,
    },
    verify_po: {
      key: 'verify_po',
      label: '校验PO',
      type: 'boolean',
      sortable: true,
    },
    verify_loading_sheet: {
      key: 'verify_loading_sheet',
      label: '校验装车单',
      type: 'boolean',
      sortable: true,
      readonly: true, // 在预约管理中只读，在出库管理中可编辑
    },
    can_create_sheet: {
      key: 'can_create_sheet',
      label: '可做单',
      type: 'boolean',
      sortable: true,
      // 在预约管理中可编辑，在出库管理中只读
    },
    has_created_sheet: {
      key: 'has_created_sheet',
      label: '已做单',
      type: 'boolean',
      sortable: true,
      readonly: true, // 在预约管理中只读，在出库管理中可编辑
    },
    trailer: {
      key: 'trailer',
      label: 'Trailer',
      type: 'text',
      sortable: true,
      searchable: true,
      readonly: true, // 只读，从出库管理获取
    },
    po: {
      key: 'po',
      label: 'PO',
      type: 'textarea',
      searchable: true,
      placeholder: '请输入PO信息',
    },
    notes: {
      key: 'notes',
      label: '备注',
      type: 'textarea',
    },
    status: {
      key: 'status',
      label: '状态',
      type: 'select',
      sortable: true,
      hidden: true, // 已弃用，改用校验PO、校验装车单
      options: [
        { label: '待处理', value: '待处理' },
        { label: '已校验PO', value: '已校验PO' },
        { label: '已校验装车单', value: '已校验装车单' },
      ],
    },
  },
  
  list: {
    defaultSort: 'created_at',
    defaultOrder: 'desc',
    columns: [
      'reference_number',
      'delivery_method',
      'appointment_account',
      'appointment_type',
      'origin_location',
      'destination_location',
      'notes', // 备注（与出库管理连通），放在前面便于查看
      'confirmed_start',
      'eta',
      'total_pallets',
      'rejected',
      'verify_po',
      'verify_loading_sheet',
      'can_create_sheet',
      'has_created_sheet',
      'trailer',
      'po',
    ],
    searchFields: ['reference_number', 'po'], // 搜索预约号码和PO字段
    // 筛选配置（快速筛选）- 手动覆盖 delivery_method 为多选
    filterFields: [
      {
        field: 'delivery_method',
        label: '派送方式',
        type: 'select',
        options: [
          { label: '私仓', value: '私仓' },
          { label: '自提', value: '自提' },
          { label: '直送', value: '直送' },
          { label: '卡派', value: '卡派' },
        ],
        multiple: true, // 启用多选
      },
    ],
    // 高级搜索配置（多条件组合）- 已自动生成，包含所有 columns 中显示的字段（包括原始字段、读取字段、计算字段）
    // advancedSearchFields 已由 search-config-generator 自动生成
    // 批量操作配置
    batchOperations: {
      enabled: true,
      edit: {
        enabled: true,
        fields: ['reference_number', 'origin_location_id', 'location_id', 'confirmed_start', 'delivery_method', 'appointment_type', 'appointment_account', 'rejected', 'verify_po', 'can_create_sheet', 'po', 'notes'],
      },
      delete: {
        enabled: true,
      },
    },
    // 行内编辑：仅铅笔进入编辑，避免误点单元格（预约管理）
    inlineEdit: {
      enabled: true,
      cellClickToEdit: false,
      fields: ['reference_number', 'origin_location_id', 'location_id', 'confirmed_start', 'delivery_method', 'appointment_type', 'appointment_account', 'rejected', 'verify_po', 'can_create_sheet', 'po', 'notes'],
    },
  },
  
  formFields: [
    'reference_number',
    'order_id',
    'origin_location_id',
    'location_id',
    'appointment_type',
    'delivery_method',
    'appointment_account',
    'confirmed_start',
    'rejected',
    'verify_po',
    'verify_loading_sheet',
    'po',
    'notes',
  ],
  
  permissions: {
    list: ['admin', 'oms_manager', 'tms_manager', 'wms_manager', 'employee', 'user', 'oms_operator', 'wms_operator'],
    create: ['admin', 'oms_manager', 'oms_operator', 'wms_operator'], // 操作部门和仓库部门都可以创建预约
    update: ['admin', 'oms_manager', 'oms_operator', 'wms_operator'], // 操作部门和仓库部门都可以编辑预约
    delete: ['admin', 'oms_manager', 'oms_operator', 'wms_operator'], // 操作部门和仓库部门都可以删除预约
  },
  
  prisma: {
    model: 'delivery_appointments',
    include: {
      orders: {
        select: {
          order_id: true,
          order_number: true,
          order_detail: {
            select: {
              id: true,
              estimated_pallets: true,
            },
          },
        },
      },
      locations: {
        select: {
          location_id: true,
          name: true,
          location_code: true,
        },
      },
      locations_delivery_appointments_origin_location_idTolocations: {
        select: {
          location_id: true,
          name: true,
          location_code: true,
        },
      },
    },
  },
}

