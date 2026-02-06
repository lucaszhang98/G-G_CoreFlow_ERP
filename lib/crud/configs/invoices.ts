/**
 * 发票管理实体配置（Phase 1 骨架）
 */

import { EntityConfig } from '../types'

export const invoiceConfig: EntityConfig = {
  name: 'invoice',
  displayName: '发票',
  pluralName: '发票',

  apiPath: '/api/finance/invoices',
  detailPath: '/dashboard/finance/invoices',
  idField: 'invoice_id',

  schemaName: 'invoice',

  fields: {
    invoice_id: {
      key: 'invoice_id',
      label: 'ID',
      type: 'text',
      hidden: true,
    },
    invoice_type: {
      key: 'invoice_type',
      label: '账单类型',
      type: 'badge',
      options: [
        { label: '直送', value: 'direct_delivery' },
        { label: '拆柜', value: 'unload' },
        { label: '罚款', value: 'penalty' },
        { label: '仓储', value: 'storage' },
      ],
    },
    invoice_number: {
      key: 'invoice_number',
      label: '发票号',
      type: 'text',
      required: true,
      sortable: true,
      searchable: true,
      placeholder: '请输入发票号',
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
    order_id: {
      key: 'order_id',
      label: '订单',
      type: 'relation',
      relation: {
        model: 'orders',
        displayField: 'order_number',
        valueField: 'order_id',
      },
    },
    total_amount: {
      key: 'total_amount',
      label: '总金额',
      type: 'currency',
      sortable: true,
    },
    tax_amount: {
      key: 'tax_amount',
      label: '税额',
      type: 'currency',
    },
    currency: {
      key: 'currency',
      label: '币种',
      type: 'text',
    },
    invoice_date: {
      key: 'invoice_date',
      label: '发票日期',
      type: 'date',
      sortable: true,
    },
    status: {
      key: 'status',
      label: '状态',
      type: 'badge',
      sortable: true,
      options: [
        { label: '草稿', value: 'draft' },
        { label: '已开票', value: 'issued' },
        { label: '作废', value: 'void' },
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
    defaultOrder: 'desc',
    columns: ['invoice_number', 'invoice_type', 'customer_id', 'order_id', 'invoice_date', 'status', 'total_amount', 'tax_amount', 'currency', 'notes'],
    searchFields: ['invoice_number'],
    pageSize: 10,
    filterFields: [
      {
        field: 'invoice_type',
        label: '账单类型',
        type: 'select',
        options: [
          { label: '直送', value: 'direct_delivery' },
          { label: '拆柜', value: 'unload' },
          { label: '罚款', value: 'penalty' },
          { label: '仓储', value: 'storage' },
        ],
      },
    ],
    batchOperations: {
      enabled: true,
      edit: { enabled: true },
      delete: { enabled: true },
    },
    inlineEdit: { enabled: true },
  },

  formFields: ['invoice_number', 'invoice_type', 'customer_id', 'order_id', 'total_amount', 'tax_amount', 'currency', 'invoice_date', 'status', 'notes'],

  permissions: {
    list: ['admin', 'oms_manager', 'employee', 'user'],
    create: ['admin', 'oms_manager'],
    update: ['admin', 'oms_manager'],
    delete: ['admin'],
  },

  prisma: {
    model: 'invoices',
    include: {
      customers: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      orders: {
        select: {
          order_id: true,
          order_number: true,
        },
      },
    },
  },
}
