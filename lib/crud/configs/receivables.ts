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
    },
    balance: {
      key: 'balance',
      label: '余额',
      type: 'currency',
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
    defaultSort: 'due_date',
    defaultOrder: 'asc',
    columns: ['invoice_id', 'customer_id', 'receivable_amount', 'allocated_amount', 'balance', 'due_date', 'status', 'notes'],
    searchFields: [],
    pageSize: 10,
    batchOperations: {
      enabled: true,
      edit: { enabled: true },
      delete: { enabled: true },
    },
    inlineEdit: { enabled: true },
  },

  formFields: ['invoice_id', 'customer_id', 'receivable_amount', 'allocated_amount', 'balance', 'due_date', 'status', 'notes'],

  permissions: {
    list: ['admin', 'oms_manager', 'employee', 'user'],
    create: ['admin', 'oms_manager'],
    update: ['admin', 'oms_manager'],
    delete: ['admin'],
  },

  prisma: {
    model: 'receivables',
    include: {
      invoices: {
        select: {
          invoice_id: true,
          invoice_number: true,
          total_amount: true,
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
