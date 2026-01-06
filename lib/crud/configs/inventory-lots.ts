/**
 * 库存管理实体配置（完全可序列化）
 */

import { EntityConfig } from '../types'

export const inventoryLotConfig: EntityConfig = {
  name: 'inventory_lot',
  displayName: '库存管理',
  pluralName: '库存管理',
  
  apiPath: '/api/wms/inventory-lots',
  detailPath: '/dashboard/wms/inventory-lots',
  idField: 'inventory_lot_id',
  
  // Schema 名称，用于动态导入
  schemaName: 'inventory_lot',
  
  fields: {
    inventory_lot_id: {
      key: 'inventory_lot_id',
      label: 'ID',
      type: 'text',
    },
    // 从拆柜规划表继承的字段
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
    planned_unload_at: {
      key: 'planned_unload_at',
      label: '预计拆柜日期',
      type: 'date',
      sortable: true,
    },
    // 从orders_detail继承的字段（需要确认字段名）
    delivery_nature: {
      key: 'delivery_nature',
      label: '送仓性质',
      type: 'select',
      sortable: true,
      options: [
        { label: 'AMZ', value: 'AMZ' },
        { label: '扣货', value: '扣货' },
        { label: '已放行', value: '已放行' },
        { label: '私仓', value: '私仓' },
      ],
    },
    delivery_location: {
      key: 'delivery_location',
      label: '仓点',
      type: 'location',
      searchable: true,
    },
    // 表内自己的字段
    storage_location_code: {
      key: 'storage_location_code',
      label: '位置',
      type: 'text',
      sortable: true,
      searchable: true,
      placeholder: '请输入位置',
    },
    pallet_count: {
      key: 'pallet_count',
      label: '实际板数',
      type: 'number',
      sortable: true,
      placeholder: '请输入实际板数',
    },
    remaining_pallet_count: {
      key: 'remaining_pallet_count',
      label: '剩余板数',
      type: 'number',
      sortable: true,
      placeholder: '请输入剩余板数',
    },
    unbooked_pallet_count: {
      key: 'unbooked_pallet_count',
      label: '未约板数',
      type: 'number',
      sortable: true,
      placeholder: '请输入未约板数',
    },
    delivery_progress: {
      key: 'delivery_progress',
      label: '送货进度',
      type: 'number',
      sortable: false, // 计算字段，不支持排序
      placeholder: '送货进度（自动计算）',
    },
    notes: {
      key: 'notes',
      label: '备注',
      type: 'textarea',
      placeholder: '请输入备注',
    },
    // 关联字段
    order_id: {
      key: 'order_id',
      label: '订单ID',
      type: 'text',
    },
    order_detail_id: {
      key: 'order_detail_id',
      label: '订单明细ID',
      type: 'text',
    },
    inbound_receipt_id: {
      key: 'inbound_receipt_id',
      label: '拆柜规划ID',
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
      required: true,
    },
    status: {
      key: 'status',
      label: '状态',
      type: 'badge',
      sortable: true,
      options: [
        { label: '可用', value: 'available' },
        { label: '已分配', value: 'allocated' },
        { label: '已发货', value: 'shipped' },
        { label: '已预留', value: 'reserved' },
      ],
    },
    lot_number: {
      key: 'lot_number',
      label: '批次号',
      type: 'text',
      sortable: true,
      searchable: true,
    },
    received_date: {
      key: 'received_date',
      label: '收货日期',
      type: 'date',
      sortable: true,
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
      'planned_unload_at',
      'delivery_nature',
      'delivery_location',
      'storage_location_code',
      'pallet_count',
      'remaining_pallet_count',
      'unbooked_pallet_count',
      'delivery_progress',
    ],
    searchFields: ['container_number'], // 只搜索柜号（最重要的字段）
    pageSize: 20,
    // 筛选配置（快速筛选）- 手动定义，排除 warehouse_id，添加送仓性质、仓点、剩余板数、未约板数、送仓进度
    filterFields: [
      // 送仓性质筛选
      {
        field: 'delivery_nature',
        label: '送仓性质',
        type: 'select',
        options: [
          { label: 'AMZ', value: 'AMZ' },
          { label: '扣货', value: '扣货' },
          { label: '已放行', value: '已放行' },
          { label: '私仓', value: '私仓' },
        ],
      },
      // 仓点筛选（通过 order_detail 关联筛选）
      {
        field: 'delivery_location',
        label: '仓点',
        type: 'select',
        relation: {
          model: 'locations',
          displayField: 'location_code',
          valueField: 'location_id',
        },
        // 注意：delivery_location 是 order_detail 表的字段，存储的是 location_id 的字符串形式
        // 通过 relation 配置，使用模糊搜索下拉框来选择位置
      },
      // 剩余板数筛选（零/非零）
      {
        field: 'remaining_pallet_count',
        label: '剩余板数',
        type: 'select',
        options: [
          { label: '有剩余', value: 'non_zero' },
          { label: '无剩余', value: 'zero' },
        ],
      },
      // 未约板数筛选（零/非零）
      {
        field: 'unbooked_pallet_count',
        label: '未约板数',
        type: 'select',
        options: [
          { label: '有未约', value: 'non_zero' },
          { label: '无未约', value: 'zero' },
        ],
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
      // 日期筛选
      {
        field: 'planned_unload_at',
        label: '预计拆柜日期',
        type: 'dateRange',
        dateFields: ['planned_unload_at'],
      },
    ],
    // 高级搜索配置（多条件组合）- 已自动生成，包含所有 columns 中显示的字段（包括原始字段、读取字段、计算字段）
    // advancedSearchFields 已由 search-config-generator 自动生成
    // 批量操作配置
    batchOperations: {
      enabled: true,
      edit: {
        enabled: true,
        fields: ['status'],
      },
      delete: {
        enabled: true,
      },
    },
    // 行内编辑配置
    inlineEdit: {
      enabled: true,
      fields: [
        'storage_location_code',
        'pallet_count',
        'remaining_pallet_count',
        'unbooked_pallet_count',
        // 'delivery_progress', // 送货进度是计算字段，不可编辑
        'notes',
      ],
    },
  },
  
  formFields: [
    'order_id',
    'order_detail_id',
    'inbound_receipt_id',
    'warehouse_id',
    'storage_location_code',
    'pallet_count',
    'remaining_pallet_count',
    'unbooked_pallet_count',
    // 'delivery_progress', // 送货进度是计算字段，不在表单中显示
    'notes',
    'status',
    'lot_number',
    'received_date',
  ],
  
  permissions: {
    list: ['admin', 'oms_manager', 'tms_manager', 'wms_manager', 'employee', 'user'],
    create: [], // WMS 模块不允许手动创建
    update: ['admin', 'wms_manager'],
    delete: [], // WMS 模块不允许删除
  },
  
  prisma: {
    model: 'inventory_lots',
    include: {
      orders: {
        select: {
          order_id: true,
          order_number: true,
          container_number: true,
          order_date: true,
          customers: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      },
      order_detail: {
        select: {
          id: true,
          quantity: true,
          volume: true,
          estimated_pallets: true,
          delivery_nature: true,
          delivery_location: true,
        },
      },
      inbound_receipt: {
        select: {
          inbound_receipt_id: true,
          planned_unload_at: true,
          delivery_progress: true,
        },
      },
      warehouses: {
        select: {
          warehouse_id: true,
          name: true,
          warehouse_code: true,
        },
      },
    },
  },
}

