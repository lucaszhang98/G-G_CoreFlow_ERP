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
        valueField: 'id', // 关联表中的字段名（departments 表的 id）
      },
      relationField: 'parent_id', // 当前表中的数据库字段名，用于筛选和更新
    },
    manager: {
      key: 'manager',
      label: '负责人',
      type: 'relation',
      relation: {
        model: 'users',
        displayField: 'name',
        valueField: 'id', // 关联表中的字段名（users 表的 id）
      },
      relationField: 'manager_id', // 当前表中的数据库字段名，用于筛选和更新
    },
    description: {
      key: 'description',
      label: '描述',
      type: 'textarea',
      placeholder: '请输入部门描述',
    },
    created_at: {
      key: 'created_at',
      label: '创建时间',
      type: 'date',
      sortable: true,
      readonly: true, // 数据库自动维护，不允许编辑
      hidden: false, // 在列表中显示，但不在表单中显示
    },
  },
  
  list: {
    defaultSort: 'code',
    defaultOrder: 'asc',
    columns: ['code', 'name', 'parent', 'manager', 'created_at'],
    searchFields: ['name'], // 只搜索部门名称（最重要的字段）
    pageSize: 10,
    // 筛选配置（快速筛选）- 已自动生成，包含所有 select/relation/date/datetime 字段
    // filterFields 已由 search-config-generator 自动生成
    // 高级搜索配置（多条件组合）- 已自动生成，包含所有 columns 中显示的字段（包括原始字段、读取字段、计算字段）
    // advancedSearchFields 已由 search-config-generator 自动生成
    // 批量操作配置
    batchOperations: {
      enabled: true,
      edit: {
        enabled: true,
        fields: ['code', 'name', 'parent_id', 'manager_id', 'description'], // 可批量编辑的字段，与formFields一致，排除created_at
      },
      delete: {
        enabled: true,
      },
    },
    // 行内编辑配置
    inlineEdit: {
      enabled: true,
      fields: ['code', 'name', 'parent_id', 'manager_id', 'description'], // 可编辑的字段，与formFields一致，排除created_at
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



