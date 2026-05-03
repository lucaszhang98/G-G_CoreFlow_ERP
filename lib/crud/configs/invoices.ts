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
        { label: '负数账单', value: 'penalty' },
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
      label: '柜号',
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
      /** 由明细汇总 recalc，禁止在表单/行内/批量中手改 */
      readonly: true,
      computed: true,
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
        { label: '已审核', value: 'audited' },
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
    pageSize: 100,
    filterFields: [
      {
        field: 'invoice_type',
        label: '账单类型',
        type: 'select',
        options: [
          { label: '直送', value: 'direct_delivery' },
          { label: '拆柜', value: 'unload' },
          { label: '负数账单', value: 'penalty' },
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

  formFields: ['invoice_number', 'invoice_type', 'customer_id', 'order_id', 'tax_amount', 'currency', 'invoice_date', 'status', 'notes'],

  detailInvoicePdfField: 'invoice_id',

  permissions: {
    list: ['admin', 'oms_manager', 'employee', 'user', 'oms_operator'],
    create: ['admin', 'oms_manager', 'oms_operator'], // 操作部门可以创建账单
    update: ['admin', 'oms_manager', 'oms_operator'], // 操作部门可以编辑账单
    delete: ['admin', 'oms_manager', 'oms_operator'], // 操作部门可以删除账单
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

/** 直送账单列表用：仅显示直送类型，详情跳转至直送账单详情页 */
export const directDeliveryBillConfig: EntityConfig = {
  ...invoiceConfig,
  displayName: '直送账单',
  pluralName: '直送账单',
  detailPath: '/dashboard/finance/bills/direct-delivery',
  list: {
    ...invoiceConfig.list,
    columns: ['invoice_number', 'customer_id', 'order_id', 'invoice_date', 'status', 'total_amount', 'currency', 'notes'],
    /** 模糊搜索：发票号 + 关联订单柜号（order_number），由 /api/finance/invoices 列表接口处理 */
    searchPlaceholder: '搜索发票号、柜号...',
    /** 快速筛选不展示账单类型、柜号（列表已限定直送且柜号可用搜索框） */
    filterFieldKeysExclude: ['invoice_type', 'order_id'],
    /** 列表与合计：不展示关联订单已取消的直送账单（与删单/补数规则一致） */
    excludeCancelledOrders: true,
  },
  permissions: {
    ...invoiceConfig.permissions,
    create: [], // 新建通过列表「新建直送账单」弹窗（按柜号）或 API create-from-container
    delete: [], // 直送账单列表不允许删除
  },
}

/** 拆柜账单（发票 unload）：与直送账单同流程，独立列表与详情路由 */
export const containerUnloadBillConfig: EntityConfig = {
  ...invoiceConfig,
  displayName: '拆柜账单',
  pluralName: '拆柜账单',
  detailPath: '/dashboard/finance/bills/container-unload',
  list: {
    ...invoiceConfig.list,
    columns: ['invoice_number', 'customer_id', 'order_id', 'invoice_date', 'status', 'total_amount', 'currency', 'notes'],
    searchPlaceholder: '搜索发票号、柜号...',
    /** 列表已限定拆柜，不展示账单类型/柜号筛选（仍用 initialFilterValues 请求接口） */
    filterFieldKeysExclude: ['invoice_type', 'order_id'],
  },
  permissions: {
    ...invoiceConfig.permissions,
    create: [], // 新建通过 /bills/container-unload/new
    delete: [], // 拆柜账单列表不允许删除
  },
}

/** 仓储账单列表：仅 storage；不展示账单类型筛选；明细由预约/入库自动同步 */
export const storageBillConfig: EntityConfig = {
  ...invoiceConfig,
  displayName: '仓储账单',
  pluralName: '仓储账单',
  detailPath: '/dashboard/finance/bills/storage',
  list: {
    ...invoiceConfig.list,
    searchPlaceholder: '搜索发票号、柜号...',
    filterFieldKeysExclude: ['invoice_type', 'order_id'],
    /** 与直送账单一致：不列出关联订单已取消的仓储账单 */
    excludeCancelledOrders: true,
  },
  permissions: {
    ...invoiceConfig.permissions,
    create: [], // 无手动新建
    delete: [], // 仓储账单列表不允许删除
  },
}

/** 负数账单（invoice_type=penalty）：金额可为负；存库枚举值仍为 penalty */
export const penaltyBillConfig: EntityConfig = {
  ...invoiceConfig,
  displayName: '负数账单',
  pluralName: '负数账单',
  detailPath: '/dashboard/finance/bills/penalty',
  list: {
    ...invoiceConfig.list,
    columns: ['invoice_number', 'customer_id', 'order_id', 'invoice_date', 'status', 'total_amount', 'currency', 'notes'],
    searchPlaceholder: '搜索发票号、柜号...',
    filterFieldKeysExclude: ['invoice_type', 'order_id'],
  },
  permissions: {
    ...invoiceConfig.permissions,
    /** 新建仅通过列表「新建负数账单」弹窗按柜号创建 */
    create: [],
    delete: [], // 负数账单列表不允许删除
  },
}
