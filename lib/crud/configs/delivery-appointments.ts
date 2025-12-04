/**
 * 预约管理实体配置（完全可序列化）
 */

import { EntityConfig } from '../types'

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
      type: 'text',
      sortable: true,
      searchable: true,
    },
    appointment_type: {
      key: 'appointment_type',
      label: '预约类型',
      type: 'select',
      sortable: true,
      options: [
        { label: '地板', value: '地板' },
        { label: '卡板', value: '卡板' },
      ],
    },
    origin_location: {
      key: 'origin_location',
      label: '起始地',
      type: 'location',
      sortable: true,
    },
    destination_location: {
      key: 'destination_location',
      label: '目的地',
      type: 'location',
      sortable: true,
    },
    confirmed_start: {
      key: 'confirmed_start',
      label: '送货时间',
      type: 'datetime',
      sortable: true,
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
    notes: {
      key: 'notes',
      label: '备注',
      type: 'textarea',
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
      'confirmed_start',
      'total_pallets',
      'rejected',
      'notes',
    ],
    // 批量操作配置
    batchOperations: {
      enabled: true,
      edit: {
        enabled: true,
        fields: ['origin_location_id', 'location_id', 'confirmed_start', 'delivery_method', 'appointment_type', 'appointment_account', 'rejected', 'notes'],
      },
      delete: {
        enabled: true,
      },
    },
    // 行内编辑配置
    inlineEdit: {
      enabled: true,
      fields: ['origin_location_id', 'location_id', 'confirmed_start', 'delivery_method', 'appointment_type', 'appointment_account', 'rejected', 'notes'],
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
    'notes',
  ],
  
  permissions: {
    list: ['admin', 'oms_manager', 'tms_manager', 'wms_manager', 'employee', 'user'],
    create: ['admin', 'oms_manager'],
    update: ['admin', 'oms_manager'],
    delete: ['admin'],
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

