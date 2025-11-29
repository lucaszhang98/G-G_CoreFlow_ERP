/**
 * 出库管理实体配置（完全可序列化）
 */

import { EntityConfig } from '../types'

export const outboundShipmentConfig: EntityConfig = {
  name: 'outbound_shipments',
  displayName: '出库管理',
  pluralName: '出库管理',
  
  apiPath: '/api/wms/outbound-shipments',
  detailPath: '/dashboard/wms/outbound-shipments',
  idField: 'outbound_shipment_id',
  
  // Schema 名称，用于动态导入
  schemaName: 'outbound_shipment',
  
  fields: {
    outbound_shipment_id: {
      key: 'outbound_shipment_id',
      label: 'ID',
      type: 'text',
    },
    shipment_number: {
      key: 'shipment_number',
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
    is_rejected: {
      key: 'is_rejected',
      label: '拒收',
      type: 'checkbox',
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
      type: 'text',
      sortable: true,
    },
    driver_name: {
      key: 'driver_name',
      label: '司机',
      type: 'text',
      sortable: true,
    },
    trailer_code: {
      key: 'trailer_code',
      label: 'Trailer',
      type: 'text',
      sortable: true,
    },
    scheduled_load_time: {
      key: 'scheduled_load_time',
      label: '送货时间',
      type: 'datetime',
      sortable: true,
    },
    destination_location: {
      key: 'destination_location',
      label: '目的地',
      type: 'text',
      sortable: true,
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
  },
  
  list: {
    defaultSort: 'created_at',
    defaultOrder: 'desc',
    columns: [
      'shipment_number',
      'delivery_method',
      'is_rejected',
      'appointment_account',
      'appointment_type',
      'loaded_by_name',
      'origin_location',
      'driver_name',
      'trailer_code',
      'scheduled_load_time',
      'destination_location',
      'total_pallets',
      'notes',
    ],
  },
  
  form: {
    fields: [
      {
        key: 'shipment_number',
        label: '预约号码',
        type: 'text',
        required: false,
      },
      {
        key: 'delivery_method',
        label: '派送方式',
        type: 'text',
        required: false,
      },
      {
        key: 'is_rejected',
        label: '拒收',
        type: 'checkbox',
        required: false,
      },
      {
        key: 'appointment_account',
        label: '预约账号',
        type: 'text',
        required: false,
      },
      {
        key: 'appointment_type_code',
        label: '预约类型',
        type: 'select',
        required: false,
        options: [], // 动态加载
      },
      {
        key: 'loaded_by',
        label: '装车人',
        type: 'select',
        required: false,
        options: [], // 动态加载
      },
      {
        key: 'origin_location_id',
        label: '起始地',
        type: 'select',
        required: false,
        options: [], // 动态加载
      },
      {
        key: 'driver_id',
        label: '司机',
        type: 'select',
        required: false,
        options: [], // 动态加载
      },
      {
        key: 'trailer_id',
        label: 'Trailer',
        type: 'select',
        required: false,
        options: [], // 动态加载
      },
      {
        key: 'scheduled_load_time',
        label: '送货时间',
        type: 'datetime',
        required: false,
      },
      {
        key: 'destination_location_id',
        label: '目的地',
        type: 'select',
        required: false,
        options: [], // 动态加载
      },
      {
        key: 'total_pallets',
        label: '板数',
        type: 'number',
        required: false,
      },
      {
        key: 'notes',
        label: '备注',
        type: 'textarea',
        required: false,
      },
    ],
  },
  
  permissions: {
    list: ['admin', 'oms_manager', 'tms_manager', 'wms_manager', 'employee', 'user'],
    create: ['admin', 'wms_manager'],
    update: ['admin', 'wms_manager'],
    delete: ['admin'],
  },
  
  prisma: {
    model: 'outbound_shipments',
    include: {
      locations: {
        select: {
          location_id: true,
          name: true,
          location_code: true,
        },
      },
      locations_outbound_shipments_origin_location_idTolocations: {
        select: {
          location_id: true,
          name: true,
          location_code: true,
        },
      },
      drivers: {
        select: {
          driver_id: true,
          driver_code: true,
        },
      },
      trailers: {
        select: {
          trailer_id: true,
          trailer_code: true,
        },
      },
      users_outbound_shipments_loaded_byTousers: {
        select: {
          id: true,
          full_name: true,
          username: true,
        },
      },
      outbound_shipment_lines: {
        select: {
          order_id: true,
          orders: {
            select: {
              order_id: true,
              delivery_appointments: {
                select: {
                  appointment_id: true,
                  reference_number: true,
                  appointment_type_code: true,
                  appointment_types: {
                    select: {
                      appointment_type_code: true,
                      description: true,
                    },
                  },
                },
                take: 1, // 只取第一个预约
              },
            },
          },
        },
      },
    },
  },
}

