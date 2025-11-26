/**
 * 部门管理实体配置（完全可序列化）
 */

import { EntityConfig } from '../types'

export const departmentConfig: EntityConfig = {
  name: 'department',
  displayName: '部门',
  pluralName: '部门',
  
  apiPath: '/api/departments',
  detailPath: '/dashboard/settings/departments',
  
  // Schema 名称，用于动态导入
  schemaName: 'department',
  
  fields: {
    id: {
      key: 'id',
      label: 'ID',
      type: 'text',
    },
    code: {
      key: 'code',
      label: '部门代码',
      type: 'text',
      required: true,
      sortable: true,
      searchable: true,
      placeholder: '请输入部门代码',
    },
    name: {
      key: 'name',
      label: '部门名称',
      type: 'text',
      required: true,
      sortable: true,
      searchable: true,
      placeholder: '请输入部门名称',
    },
    parent: {
      key: 'parent',
      label: '上级部门',
      type: 'relation',
      relation: {
        model: 'departments',
        displayField: 'name',
        valueField: 'parent_id',
      },
    },
    manager: {
      key: 'manager',
      label: '负责人',
      type: 'relation',
      relation: {
        model: 'users',
        displayField: 'full_name',
        valueField: 'manager_id',
      },
    },
    description: {
      key: 'description',
      label: '描述',
      type: 'textarea',
      placeholder: '请输入部门描述（可选）',
    },
    created_at: {
      key: 'created_at',
      label: '创建时间',
      type: 'date',
      sortable: true,
    },
  },
  
  list: {
    defaultSort: 'code',
    defaultOrder: 'asc',
    columns: ['code', 'name', 'parent', 'manager', 'created_at'],
    searchFields: ['code', 'name'],
    pageSize: 10,
    // 筛选配置（快速筛选）
    filterFields: [
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
        field: 'description',
        label: '描述',
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
      },
      delete: {
        enabled: true,
      },
    },
    // 行内编辑配置
    inlineEdit: {
      enabled: true,
    },
  },
  
  formFields: ['code', 'name', 'parent_id', 'manager_id', 'description'],
  
  permissions: {
    list: ['admin', 'oms_manager', 'tms_manager', 'wms_manager', 'employee', 'user'],
    create: ['admin'],
    update: ['admin'],
    delete: ['admin'],
  },
  
  prisma: {
    model: 'departments',
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



