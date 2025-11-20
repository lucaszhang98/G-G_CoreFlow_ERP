/**
 * 货柜管理实体配置（完全可序列化）
 */

import { EntityConfig } from '../types'

export const trailerConfig: EntityConfig = {
  name: 'trailer',
  displayName: '货柜',
  pluralName: '货柜',
  
  apiPath: '/api/trailers',
  detailPath: '/dashboard/settings/trailers',
  idField: 'trailer_id',
  
  // Schema 名称，用于动态导入
  schemaName: 'trailer',
  
  fields: {
    trailer_id: {
      key: 'trailer_id',
      label: 'ID',
      type: 'text',
    },
    trailer_code: {
      key: 'trailer_code',
      label: '货柜代码',
      type: 'text',
      sortable: true,
      searchable: true,
      placeholder: '请输入货柜代码（可选）',
    },
    trailer_type: {
      key: 'trailer_type',
      label: '货柜类型',
      type: 'text',
      searchable: true,
      placeholder: '请输入货柜类型（可选）',
    },
    department: {
      key: 'department',
      label: '部门',
      type: 'relation',
      relation: {
        model: 'departments',
        displayField: 'name',
        valueField: 'department_id',
      },
    },
    status: {
      key: 'status',
      label: '状态',
      type: 'badge',
      sortable: true,
      options: [
        { label: '可用', value: 'available' },
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
    defaultSort: 'trailer_code',
    defaultOrder: 'asc',
    columns: ['trailer_code', 'trailer_type', 'department', 'status', 'created_at'],
    searchFields: ['trailer_code', 'trailer_type'],
    pageSize: 10,
  },
  
  formFields: ['trailer_code', 'trailer_type', 'length_feet', 'capacity_weight', 'capacity_volume', 'status', 'department_id', 'notes'],
  
  permissions: {
    list: ['admin', 'oms_manager', 'tms_manager', 'wms_manager', 'employee', 'user'],
    create: ['admin', 'tms_manager', 'wms_manager'],
    update: ['admin', 'tms_manager', 'wms_manager'],
    delete: ['admin'],
  },
  
  prisma: {
    model: 'trailers',
    include: {
      departments: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  },
}

