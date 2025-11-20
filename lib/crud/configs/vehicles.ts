/**
 * 车辆管理实体配置（完全可序列化）
 */

import { EntityConfig } from '../types'

export const vehicleConfig: EntityConfig = {
  name: 'vehicle',
  displayName: '车辆',
  pluralName: '车辆',
  
  apiPath: '/api/vehicles',
  detailPath: '/dashboard/settings/vehicles',
  idField: 'vehicle_id',
  
  // Schema 名称，用于动态导入
  schemaName: 'vehicle',
  
  fields: {
    vehicle_id: {
      key: 'vehicle_id',
      label: 'ID',
      type: 'text',
    },
    vehicle_code: {
      key: 'vehicle_code',
      label: '车辆代码',
      type: 'text',
      sortable: true,
      searchable: true,
      placeholder: '请输入车辆代码（可选）',
    },
    plate_number: {
      key: 'plate_number',
      label: '车牌号',
      type: 'text',
      required: true,
      sortable: true,
      searchable: true,
      placeholder: '请输入车牌号',
    },
    vehicle_type: {
      key: 'vehicle_type',
      label: '车辆类型',
      type: 'text',
      searchable: true,
      placeholder: '请输入车辆类型（可选）',
    },
    carrier: {
      key: 'carrier',
      label: '承运商',
      type: 'relation',
      relation: {
        model: 'carriers',
        displayField: 'name',
        valueField: 'carrier_id',
      },
    },
    status: {
      key: 'status',
      label: '状态',
      type: 'badge',
      sortable: true,
      options: [
        { label: '可用', value: 'active' },
        { label: '维修', value: 'maintenance' },
        { label: '停用', value: 'inactive' },
      ],
    },
    created_at: {
      key: 'created_at',
      label: '创建时间',
      type: 'date',
      sortable: true,
    },
  },
  
  list: {
    defaultSort: 'vehicle_code',
    defaultOrder: 'asc',
    columns: ['vehicle_code', 'plate_number', 'vehicle_type', 'carrier', 'status', 'created_at'],
    searchFields: ['vehicle_code', 'plate_number', 'vehicle_type'],
    pageSize: 10,
  },
  
  formFields: ['vehicle_code', 'plate_number', 'vehicle_type', 'vin', 'capacity_weight', 'capacity_volume', 'status', 'carrier_id', 'notes'],
  
  permissions: {
    list: ['admin', 'oms_manager', 'tms_manager', 'wms_manager', 'employee', 'user'],
    create: ['admin', 'tms_manager'],
    update: ['admin', 'tms_manager'],
    delete: ['admin'],
  },
  
  prisma: {
    model: 'vehicles',
    include: {
      carriers: {
        select: {
          carrier_id: true,
          name: true,
          carrier_code: true,
        },
      },
    },
  },
}

