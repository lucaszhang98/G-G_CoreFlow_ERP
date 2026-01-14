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
      searchable: true,
    },
    container_number: {
      key: 'container_number',
      label: '柜号',
      type: 'text',
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
      type: 'relation',
      relation: {
        model: 'users',
        displayField: 'full_name',
        valueField: 'id',
      },
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
      computed: true, // 计算字段：从关联的 inventory_lots 按板数加权平均计算
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
    defaultSort: 'eta_date',
    defaultOrder: 'asc',
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
    ],
    searchFields: ['container_number'], // 只搜索柜号（最重要的字段）
    pageSize: 20,
    // 筛选配置（快速筛选）- 手动定义，排除 warehouse_id 和 created_at
    filterFields: [
      // 状态筛选
      {
        field: 'status',
        label: '状态',
        type: 'select',
        options: [
          { label: '待处理', value: 'pending' },
          { label: '已到仓', value: 'arrived' },
          { label: '已入库', value: 'received' },
        ],
      },
      // 拆柜人员筛选
      {
        field: 'unloaded_by',
        label: '拆柜人员',
        type: 'select',
        relation: {
          model: 'users',
          displayField: 'full_name',
          valueField: 'id',
        },
      },
      // 入库人员筛选
      {
        field: 'received_by',
        label: '入库人员',
        type: 'select',
        relation: {
          model: 'users',
          displayField: 'full_name',
          valueField: 'id',
        },
      },
      // 日期筛选（排除 created_at）
      {
        field: 'order_date',
        label: '预报日期',
        type: 'dateRange',
        dateFields: ['order_date'],
      },
      {
        field: 'eta_date',
        label: '到港日期',
        type: 'dateRange',
        dateFields: ['eta_date'],
      },
      {
        field: 'ready_date',
        label: 'Ready日期',
        type: 'dateRange',
        dateFields: ['ready_date'],
      },
      {
        field: 'lfd_date',
        label: 'LFD',
        type: 'dateRange',
        dateFields: ['lfd_date'],
      },
      {
        field: 'pickup_date',
        label: '提柜日期',
        type: 'dateRange',
        dateFields: ['pickup_date'],
      },
      {
        field: 'planned_unload_at',
        label: '拆柜日期',
        type: 'dateRange',
        dateFields: ['planned_unload_at'],
      },
      // 送仓进度筛选（100%/非100%）
      {
        field: 'delivery_progress',
        label: '送仓进度',
        type: 'select',
        options: [
          { label: '已完成', value: 'complete' },
          { label: '未完成', value: 'incomplete' },
        ],
      },
    ],
    // 高级搜索配置（多条件组合）- 已自动生成，包含所有 columns 中显示的字段（包括原始字段、读取字段、计算字段）
    // advancedSearchFields 已由 search-config-generator 自动生成
    // 批量操作配置
    batchOperations: {
      enabled: true,
      edit: {
        enabled: true,
        fields: ['status', 'planned_unload_at', 'unloaded_by', 'received_by'],
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
      users_inbound_receipt_unloaded_byTousers: {
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

