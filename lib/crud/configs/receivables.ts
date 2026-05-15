/**
 * 应收管理实体配置（Phase 1 骨架）
 */

import { EntityConfig } from '../types'

export const receivableConfig: EntityConfig = {
  name: 'receivable',
  displayName: '应收',
  pluralName: '应收',

  apiPath: '/api/finance/receivables',
  detailPath: '/dashboard/finance/receivables',
  idField: 'receivable_id',

  schemaName: 'receivable',

  fields: {
    receivable_id: {
      key: 'receivable_id',
      label: 'ID',
      type: 'text',
      hidden: true,
    },
    invoice_id: {
      key: 'invoice_id',
      label: '发票',
      type: 'relation',
      relation: {
        model: 'invoices',
        displayField: 'invoice_number',
        valueField: 'invoice_id',
      },
    },
    invoice_date: {
      key: 'invoice_date',
      label: '发票日期',
      type: 'date',
      sortable: true,
      readonly: true,
    },
    customer_id: {
      key: 'customer_id',
      label: '客户',
      type: 'relation',
      relation: {
        model: 'customers',
        displayField: 'code',
        valueField: 'id',
      },
    },
    receivable_amount: {
      key: 'receivable_amount',
      label: '应收金额',
      type: 'currency',
      sortable: true,
    },
    allocated_amount: {
      key: 'allocated_amount',
      label: '已核销',
      type: 'currency',
      readonly: true,
    },
    balance: {
      key: 'balance',
      label: '余额',
      type: 'currency',
      readonly: true,
    },
    due_date: {
      key: 'due_date',
      label: '到期日',
      type: 'date',
      sortable: true,
    },
    status: {
      key: 'status',
      label: '状态',
      type: 'badge',
      sortable: true,
      readonly: true,
      options: [
        { label: '未结', value: 'open' },
        { label: '部分核销', value: 'partial' },
        { label: '已结清', value: 'closed' },
      ],
    },
    notes: {
      key: 'notes',
      label: '备注',
      type: 'textarea',
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
    defaultSort: 'invoice_date',
    defaultOrder: 'asc',
    columns: [
      'invoice_id',
      'invoice_date',
      'customer_id',
      'receivable_amount',
      'allocated_amount',
      'balance',
      'due_date',
      'status',
      'notes',
    ],
    /** 主搜索走 api-handler 关联 invoices.invoice_number 模糊匹配 */
    searchFields: [],
    searchPlaceholder: '搜索发票号…',
    /** 快速筛选「发票」：按账单类型，不再用发票 ID 下拉 */
    filterFieldKeysExclude: ['invoice_id'],
    filterFields: [
      {
        field: 'invoice_type',
        label: '发票',
        type: 'select',
        options: [
          { label: '直送', value: 'direct_delivery' },
          { label: '拆柜', value: 'unload' },
          { label: '负数', value: 'penalty' },
          { label: '仓储', value: 'storage' },
        ],
      },
    ],
    pageSize: 100,
    batchOperations: {
      enabled: true,
      edit: { enabled: true },
      delete: { enabled: true },
    },
    inlineEdit: { enabled: true },
  },

  formFields: ['invoice_id', 'customer_id', 'receivable_amount', 'notes'],

  permissions: {
    list: ['admin', 'oms_manager', 'employee', 'user', 'oms_operator'],
    create: ['admin', 'oms_manager', 'oms_operator'], // 操作部门可以创建应收
    update: ['admin', 'oms_manager', 'oms_operator'], // 操作部门可以编辑应收
    delete: ['admin', 'oms_manager', 'oms_operator'], // 操作部门可以删除应收
  },

  prisma: {
    model: 'receivables',
    include: {
      invoices: {
        select: {
          invoice_id: true,
          invoice_number: true,
          invoice_type: true,
          total_amount: true,
          invoice_date: true,
        },
      },
      customers: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
  },
}
