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
    length_feet: {
      key: 'length_feet',
      label: '长度（英尺）',
      type: 'number',
      placeholder: '请输入长度（可选）',
    },
    capacity_weight: {
      key: 'capacity_weight',
      label: '载重容量',
      type: 'number',
      placeholder: '请输入载重容量（可选）',
    },
    capacity_volume: {
      key: 'capacity_volume',
      label: '体积容量',
      type: 'number',
      placeholder: '请输入体积容量（可选）',
    },
    notes: {
      key: 'notes',
      label: '备注',
      type: 'textarea',
      placeholder: '请输入备注（可选）',
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
    // 筛选配置（快速筛选）
    filterFields: [
      {
        field: 'status',
        label: '状态',
        type: 'select',
        options: [
          { label: '可用', value: 'available' },
          { label: '维修', value: 'maintenance' },
          { label: '停用', value: 'inactive' },
        ],
      },
      {
        field: 'created_at',
        label: '创建日期',
        type: 'dateRange',
        dateFields: ['created_at'],
      },
    ],
    // 高级搜索配置（多条件组合）
    advancedSearchFields: [
      {
        field: 'trailer_type',
        label: '货柜类型',
        type: 'text',
      },
      {
        field: 'created_at',
        label: '创建日期',
        type: 'dateRange',
        dateFields: ['created_at'],
      },
    ],
    // 批量操作配置
    batchOperations: {
      enabled: true,
      edit: {
        enabled: true,
        fields: ['status'],
      },
      delete: {
        enabled: true,
      },
    },
    // 行内编辑配置
    inlineEdit: {
      enabled: true,
      fields: ['status'],
    },
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

