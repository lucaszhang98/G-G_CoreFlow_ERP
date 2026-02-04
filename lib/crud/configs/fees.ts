/**
 * 费用主数据实体配置（第一版）
 */

import { EntityConfig } from '../types'

export const feeConfig: EntityConfig = {
  name: 'fee',
  displayName: '费用',
  pluralName: '费用',

  apiPath: '/api/finance/fees',
  detailPath: '/dashboard/finance/fees',
  idField: 'id',

  schemaName: 'fee',

  fields: {
    id: {
      key: 'id',
      label: 'ID',
      type: 'text',
      hidden: true,
    },
    fee_code: {
      key: 'fee_code',
      label: '费用编码',
      type: 'text',
      required: true,
      sortable: true,
      searchable: true,
      placeholder: '如 STORAGE',
    },
    fee_name: {
      key: 'fee_name',
      label: '费用名称',
      type: 'text',
      required: true,
      sortable: true,
      searchable: true,
      placeholder: '如 仓储费',
    },
    unit: {
      key: 'unit',
      label: '单位',
      type: 'text',
      placeholder: '板/箱/票等',
    },
    unit_price: {
      key: 'unit_price',
      label: '单价',
      type: 'currency',
      sortable: true,
    },
    currency: {
      key: 'currency',
      label: '币种',
      type: 'text',
    },
    scope_type: {
      key: 'scope_type',
      label: '归属范围',
      type: 'badge',
      sortable: true,
      options: [
        { label: '所有客户', value: 'all' },
        { label: '指定客户', value: 'customers' },
      ],
    },
    description: {
      key: 'description',
      label: '说明',
      type: 'textarea',
    },
    sort_order: {
      key: 'sort_order',
      label: '排序',
      type: 'number',
    },
    is_active: {
      key: 'is_active',
      label: '启用',
      type: 'boolean',
    },
    created_at: {
      key: 'created_at',
      label: '创建时间',
      type: 'date',
      sortable: true,
      hidden: true,
    },
    updated_at: {
      key: 'updated_at',
      label: '更新时间',
      type: 'date',
      sortable: true,
      hidden: true,
    },
  },

  list: {
    defaultSort: 'fee_code',
    defaultOrder: 'asc',
    columns: ['fee_code', 'fee_name', 'unit', 'unit_price', 'currency', 'scope_type', 'is_active', 'description'],
    searchFields: ['fee_code', 'fee_name'],
    pageSize: 10,
    batchOperations: {
      enabled: true,
      edit: { enabled: true },
      delete: { enabled: true },
    },
    inlineEdit: { enabled: true },
  },

  formFields: ['fee_code', 'fee_name', 'unit', 'unit_price', 'currency', 'scope_type', 'description', 'sort_order', 'is_active'],

  permissions: {
    list: ['admin', 'oms_manager', 'employee', 'user'],
    create: ['admin', 'oms_manager'],
    update: ['admin', 'oms_manager'],
    delete: ['admin'],
  },

  prisma: {
    model: 'fee',
    include: {},
  },
}
