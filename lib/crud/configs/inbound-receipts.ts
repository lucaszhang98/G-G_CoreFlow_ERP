/**
 * 拆柜规划实体配置（完全可序列化）
 */

import { EntityConfig } from '../types'

export const inboundReceiptConfig: EntityConfig = {
  name: 'inbound_receipt',
  displayName: '入库管理',
  pluralName: '入库管理',
  
  apiPath: '/api/wms/inbound-receipts',
  detailPath: '/dashboard/wms/inbound-receipts',
  idField: 'inbound_receipt_id',
  
  // Schema 名称，用于动态导入
  schemaName: 'inbound_receipt',
  
  fields: {
    inbound_receipt_id: {
      key: 'inbound_receipt_id',
      label: 'ID',
      type: 'text',
    },
    customer_name: {
      key: 'customer_name',
      label: '客户名称',
      type: 'text',
      sortable: true,
      searchable: true,
    },
    container_number: {
      key: 'container_number',
      label: '柜号',
      type: 'text',
      sortable: true,
      searchable: true,
    },
    order_date: {
      key: 'order_date',
      label: '预报日期',
      type: 'date',
      sortable: true,
    },
    eta_date: {
      key: 'eta_date',
      label: '到港日期',
      type: 'date',
      sortable: true,
    },
    ready_date: {
      key: 'ready_date',
      label: 'Ready日期',
      type: 'date',
      sortable: true,
    },
    lfd_date: {
      key: 'lfd_date',
      label: 'LFD',
      type: 'date',
      sortable: true,
    },
    pickup_date: {
      key: 'pickup_date',
      label: '提柜日期',
      type: 'date',
      sortable: true,
    },
    status: {
      key: 'status',
      label: '状态',
      type: 'select',
      sortable: true,
      options: [
        { label: '待处理', value: 'pending' },
        { label: '已到仓', value: 'arrived' },
        { label: '已入库', value: 'received' },
      ],
    },
    planned_unload_at: {
      key: 'planned_unload_at',
      label: '拆柜日期',
      type: 'date',
      sortable: true,
    },
    unloaded_by: {
      key: 'unloaded_by',
      label: '拆柜人员',
      type: 'text',
      searchable: true,
    },
    received_by: {
      key: 'received_by',
      label: '入库人员',
      type: 'relation',
      relation: {
        model: 'users',
        displayField: 'full_name',
        valueField: 'id',
      },
    },
    delivery_progress: {
      key: 'delivery_progress',
      label: '送货进度',
      type: 'number',
      sortable: true,
      placeholder: '请输入送货进度（0-100）',
    },
    notes: {
      key: 'notes',
      label: '备注',
      type: 'textarea',
    },
    unload_method_code: {
      key: 'unload_method_code',
      label: '卸货方式代码',
      type: 'text',
    },
    unload_method_name: {
      key: 'unload_method_name',
      label: '卸货方式',
      type: 'text',
      sortable: true,
    },
    order_id: {
      key: 'order_id',
      label: '订单ID',
      type: 'text',
    },
    warehouse_id: {
      key: 'warehouse_id',
      label: '仓库',
      type: 'relation',
      relation: {
        model: 'warehouses',
        displayField: 'name',
        valueField: 'warehouse_id',
      },
    },
    created_at: {
      key: 'created_at',
      label: '创建时间',
      type: 'date',
      sortable: true,
    },
  },
  
  list: {
    defaultSort: 'created_at',
    defaultOrder: 'desc',
    columns: [
      'customer_name',
      'container_number',
      'order_date',
      'eta_date',
      'ready_date',
      'lfd_date',
      'pickup_date',
      'status',
      'planned_unload_at',
      'unloaded_by',
      'received_by',
      'unload_method_name',
      'delivery_progress',
      'notes',
    ],
    searchFields: ['customer_name', 'container_number', 'unloaded_by'],
    pageSize: 20,
    // 筛选配置（快速筛选）
    filterFields: [
      {
        field: 'status',
        label: '状态',
        type: 'select',
        options: [
          { label: '已到仓', value: 'arrived' },
          { label: '已入库', value: 'received' },
          { label: '待处理', value: 'pending' },
        ],
      },
      {
        field: 'planned_unload_at',
        label: '拆柜日期',
        type: 'dateRange',
        dateFields: ['planned_unload_at'],
      },
    ],
    // 高级搜索配置（多条件组合）
    advancedSearchFields: [
      {
        field: 'customer_name',
        label: '客户名称',
        type: 'text',
      },
      {
        field: 'container_number',
        label: '柜号',
        type: 'text',
      },
      {
        field: 'status',
        label: '状态',
        type: 'select',
        options: [
          { label: '已到仓', value: 'arrived' },
          { label: '已入库', value: 'received' },
          { label: '待处理', value: 'pending' },
        ],
      },
    ],
    // 批量操作配置
    batchOperations: {
      enabled: true,
      edit: {
        enabled: true,
        fields: ['status', 'planned_unload_at', 'unloaded_by', 'received_by', 'notes'],
      },
      delete: {
        enabled: false,
      },
    },
    // 行内编辑配置
    inlineEdit: {
      enabled: true,
      fields: ['status', 'planned_unload_at', 'unloaded_by', 'received_by', 'notes'],
    },
  },
  
  formFields: [
    'order_id',
    'warehouse_id',
    'status',
    'planned_unload_at',
    'unloaded_by',
    'received_by',
    'notes',
  ],
  
  permissions: {
    list: ['admin', 'oms_manager', 'tms_manager', 'wms_manager', 'employee', 'user'],
    create: [], // 禁用创建功能
    update: ['admin', 'wms_manager'],
    delete: [], // 禁用删除功能
  },
  
  prisma: {
    model: 'inbound_receipt',
    include: {
      orders: {
        select: {
          order_id: true,
          order_number: true,
          order_date: true,
          eta_date: true,
          ready_date: true,
          lfd_date: true,
          pickup_date: true,
          customers: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      },
      users_inbound_receipt_received_byTousers: {
        select: {
          id: true,
          full_name: true,
          username: true,
        },
      },
      warehouses: {
        select: {
          warehouse_id: true,
          name: true,
          warehouse_code: true,
        },
      },
      unload_methods: {
        select: {
          method_code: true,
          description: true,
        },
      },
    },
  },
}

