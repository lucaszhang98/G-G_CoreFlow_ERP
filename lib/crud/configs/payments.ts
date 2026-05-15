/**
 * 收款管理实体配置
 */

import { EntityConfig } from '../types'

export const paymentConfig: EntityConfig = {
  name: 'payment',
  displayName: '收款',
  pluralName: '收款',

  apiPath: '/api/finance/payments',
  detailPath: '/dashboard/finance/payments',
  idField: 'payment_id',

  schemaName: 'payment',

  fields: {
    payment_id: {
      key: 'payment_id',
      label: 'ID',
      type: 'text',
      hidden: true,
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
    payment_date: {
      key: 'payment_date',
      label: '收款日期',
      type: 'date',
      sortable: true,
    },
    amount: {
      key: 'amount',
      label: '金额',
      type: 'currency',
      sortable: true,
    },
    currency: {
      key: 'currency',
      label: '币种',
      type: 'text',
      readonly: true,
    },
    payment_method: {
      key: 'payment_method',
      label: '收款方式',
      type: 'text',
      hidden: true,
    },
    bank_reference: {
      key: 'bank_reference',
      label: '银行参考',
      type: 'text',
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
    defaultSort: 'payment_date',
    defaultOrder: 'desc',
    columns: ['customer_id', 'payment_date', 'amount', 'currency', 'bank_reference', 'notes'],
    searchFields: ['bank_reference'],
    pageSize: 100,
    batchOperations: {
      enabled: true,
      edit: { enabled: true, fields: ['payment_date', 'amount', 'bank_reference', 'notes'] },
      delete: { enabled: true },
    },
    inlineEdit: {
      enabled: true,
      fields: ['payment_date', 'amount', 'bank_reference', 'notes'],
    },
  },

  formFields: ['customer_id', 'payment_date', 'amount', 'bank_reference', 'notes'],

  permissions: {
    list: ['admin', 'oms_manager', 'employee', 'user', 'oms_operator'],
    create: ['admin', 'oms_manager', 'oms_operator'],
    update: ['admin', 'oms_manager', 'oms_operator'],
    delete: ['admin', 'oms_manager', 'oms_operator'],
  },

  prisma: {
    model: 'payments',
    include: {
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
