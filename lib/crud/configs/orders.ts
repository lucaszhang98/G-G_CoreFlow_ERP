/**
 * 订单管理实体配置（完全可序列化）
 */

import { EntityConfig } from '../types'

export const orderConfig: EntityConfig = {
  name: 'order',
  displayName: '订单',
  pluralName: '订单',
  
  apiPath: '/api/orders',
  detailPath: '/dashboard/oms/orders',
  idField: 'order_id',
  
  // Schema 名称，用于动态导入
  schemaName: 'order',
  
  fields: {
    // order_id 是审计字段，由数据库自动生成，不在前端显示
    order_id: {
      key: 'order_id',
      label: '订单ID',
      type: 'text',
      hidden: true, // 标记为隐藏，不在前端显示
    },
    order_number: {
      key: 'order_number',
      label: '订单号',
      type: 'text',
      required: true,
      sortable: true,
      searchable: true,
      placeholder: '请输入订单号',
    },
    customer: {
      key: 'customer',
      label: '客户',
      type: 'relation',
      relation: {
        model: 'customers',
        displayField: 'name',
        valueField: 'id',
      },
    },
    // user_id 改为显示负责人名称
    user_id: {
      key: 'user_id',
      label: '负责人',
      type: 'relation',
      relation: {
        model: 'users',
        displayField: 'full_name',
        valueField: 'id',
      },
    },
    order_date: {
      key: 'order_date',
      label: '订单日期',
      type: 'date',
      sortable: true,
    },
    status: {
      key: 'status',
      label: '状态',
      type: 'badge',
      sortable: true,
      options: [
        { label: '待处理', value: 'pending' },
        { label: '已确认', value: 'confirmed' },
        { label: '已发货', value: 'shipped' },
        { label: '已交付', value: 'delivered' },
        { label: '已取消', value: 'cancelled' },
        { label: '完成留档', value: 'archived' }, // 软删除状态
      ],
    },
    total_amount: {
      key: 'total_amount',
      label: '订单金额',
      type: 'currency',
      sortable: true,
    },
    discount_amount: {
      key: 'discount_amount',
      label: '折扣金额',
      type: 'currency',
    },
    tax_amount: {
      key: 'tax_amount',
      label: '税费',
      type: 'currency',
    },
    final_amount: {
      key: 'final_amount',
      label: '最终金额',
      type: 'currency',
      sortable: true,
    },
    notes: {
      key: 'notes',
      label: '备注',
      type: 'textarea',
    },
    // created_at 和 updated_at 是审计字段，由系统自动维护，不在前端显示
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
    eta_date: {
      key: 'eta_date',
      label: 'ETA日期',
      type: 'date',
    },
    lfd_date: {
      key: 'lfd_date',
      label: 'LFD日期',
      type: 'date',
    },
    pickup_date: {
      key: 'pickup_date',
      label: '提货日期',
      type: 'date',
    },
    ready_date: {
      key: 'ready_date',
      label: '就绪日期',
      type: 'date',
    },
    return_deadline: {
      key: 'return_deadline',
      label: '归还截止日期',
      type: 'date',
    },
    container_type: {
      key: 'container_type',
      label: '货柜类型',
      type: 'select',
      options: [
        { label: '40HQ', value: '40HQ' },
        { label: '40GP', value: '40GP' },
        { label: '20GP', value: '20GP' },
        { label: '20HQ', value: '20HQ' },
        { label: '45HQ', value: '45HQ' },
        { label: '其他', value: 'other' },
      ],
    },
    container_volume: {
      key: 'container_volume',
      label: '整柜体积',
      type: 'number',
      readonly: true, // 只读字段，由系统自动计算
      computed: true, // 计算字段，从仓点明细的体积总和得出
    },
    mbl_number: {
      key: 'mbl_number',
      label: 'MBL号码',
      type: 'text',
    },
    do_issued: {
      key: 'do_issued',
      label: 'DO已签发',
      type: 'boolean',
    },
    // 以下字段隐藏，不在前端显示
    warehouse_account: {
      key: 'warehouse_account',
      label: '仓库账户',
      type: 'text',
      hidden: true,
    },
    // container_number 已从数据库删除，不再定义
    appointment_time: {
      key: 'appointment_time',
      label: '预约时间',
      type: 'date',
      hidden: true,
    },
    port_location: {
      key: 'port_location',
      label: '码头/查验站',
      type: 'text',
      hidden: true,
    },
    operation_mode: {
      key: 'operation_mode',
      label: '操作方式',
      type: 'select',
      sortable: true,
      options: [
        { label: '拆柜', value: 'unload' },
        { label: '直送', value: 'direct_delivery' },
      ],
    },
    delivery_location: {
      key: 'delivery_location',
      label: '送货地',
      type: 'text',
      hidden: true,
    },
    carrier_id: {
      key: 'carrier_id',
      label: '承运公司ID',
      type: 'number',
      hidden: true,
    },
    carrier: {
      key: 'carrier',
      label: '承运公司',
      type: 'relation',
      relation: {
        model: 'carriers',
        displayField: 'name',
        valueField: 'carrier_id',
      },
    },
    // created_by 和 updated_by 是审计字段，由系统自动维护，不在前端显示
    created_by: {
      key: 'created_by',
      label: '创建人ID',
      type: 'number',
      hidden: true,
    },
    updated_by: {
      key: 'updated_by',
      label: '更新人ID',
      type: 'number',
      hidden: true,
    },
  },
  
  list: {
    defaultSort: 'order_date',
    defaultOrder: 'desc',
    columns: ['order_number', 'customer', 'user_id', 'order_date', 'status', 'operation_mode', 'total_amount', 'discount_amount', 'tax_amount', 'final_amount', 'container_type', 'container_volume', 'eta_date', 'lfd_date', 'pickup_date', 'ready_date', 'return_deadline', 'mbl_number', 'do_issued', 'notes'],
    searchFields: ['order_number', 'mbl_number'],
    pageSize: 10,
    // 筛选配置（快速筛选）
    filterFields: [
      {
        field: 'status',
        label: '状态',
        type: 'select',
        options: [
          { label: '待处理', value: 'pending' },
          { label: '已确认', value: 'confirmed' },
          { label: '已发货', value: 'shipped' },
          { label: '已交付', value: 'delivered' },
          { label: '已取消', value: 'cancelled' },
          { label: '完成留档', value: 'archived' },
        ],
      },
      {
        field: 'operation_mode',
        label: '操作方式',
        type: 'select',
        options: [
          { label: '拆柜', value: 'unload' },
          { label: '直送', value: 'direct_delivery' },
        ],
      },
      {
        field: 'order_date',
        label: '订单日期',
        type: 'dateRange',
        dateFields: ['order_date'],
      },
      {
        field: 'eta_date',
        label: 'ETA日期',
        type: 'dateRange',
        dateFields: ['eta_date'],
      },
    ],
    // 高级搜索配置（多条件组合）
    advancedSearchFields: [
      {
        field: 'mbl_number',
        label: 'MBL号码',
        type: 'text',
      },
      // container_number 已隐藏，不在高级搜索中显示
      // {
      //   field: 'container_number',
      //   label: '柜号',
      //   type: 'text',
      // },
      {
        field: 'total_amount',
        label: '订单金额',
        type: 'numberRange',
        numberFields: ['total_amount'],
      },
      {
        field: 'final_amount',
        label: '最终金额',
        type: 'numberRange',
        numberFields: ['final_amount'],
      },
      // created_at 是审计字段，不在高级搜索中显示
      // {
      //   field: 'created_at',
      //   label: '创建日期',
      //   type: 'dateRange',
      //   dateFields: ['created_at'],
      // },
    ],
    // 行内编辑配置
    // 允许编辑的字段：订单号、客户、负责人、订单日期、状态、货柜类型、ETA、LFD、提柜日期、就绪日期、归还截止日期、MBL号码、DO、备注
    // 排除计算字段：total_amount, discount_amount, tax_amount, final_amount, container_volume
    inlineEdit: {
      enabled: true,
      fields: [
        'order_number',
        'customer',
        'user_id',
        'order_date',
        'status',
        'operation_mode',
        'container_type',
        'eta_date',
        'lfd_date',
        'pickup_date',
        'ready_date',
        'return_deadline',
        'mbl_number',
        'do_issued',
        'notes',
      ],
    },
    // 批量操作配置：禁用删除功能
    batchOperations: {
      enabled: true,
      edit: {
        enabled: true,
        fields: [
          'order_number',
          'customer',
          'user_id',
          'order_date',
          'status',
          'operation_mode',
          'container_type',
          'eta_date',
          'lfd_date',
          'pickup_date',
          'ready_date',
          'return_deadline',
          'mbl_number',
          'do_issued',
          'notes',
        ],
      },
      delete: {
        enabled: false, // 订单管理不允许删除
      },
    },
  },
  
  formFields: ['order_number', 'customer_id', 'order_date', 'status', 'operation_mode', 'total_amount', 'container_type', 'notes'],
  
  permissions: {
    list: ['admin', 'oms_manager', 'tms_manager', 'wms_manager', 'employee', 'user'],
    create: ['admin', 'oms_manager'],
    update: ['admin', 'oms_manager'],
    delete: ['admin'],
  },
  
  prisma: {
    model: 'orders',
    include: {
      customers: {
        select: {
          id: true,
          code: true,
          name: true,
          company_name: true,
        },
      },
      carriers: {
        select: {
          carrier_id: true,
          name: true,
          carrier_code: true,
        },
      },
      users_orders_user_idTousers: {
        select: {
          id: true,
          full_name: true,
        },
      },
      order_detail: {
        select: {
          id: true,
          volume: true, // 只需要 volume 字段来计算整柜体积
        },
      },
      // container_volume 字段会从数据库读取，但也会根据 order_detail 计算以确保一致性
    },
  },
}

