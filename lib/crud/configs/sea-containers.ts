/**
 * 海柜管理实体配置（完全可序列化）
 * 注意：海柜管理使用自定义API和自定义列定义，但复用框架的UI部分
 */

import { EntityConfig } from '../types'

export const seaContainerConfig: EntityConfig = {
  name: 'sea_container',
  displayName: '海柜',
  pluralName: '海柜',
  
  apiPath: '/api/tms/sea-containers',
  detailPath: '/dashboard/tms/sea-containers',
  idField: 'container_id',
  
  // Schema 名称，用于动态导入
  schemaName: 'sea_container',
  
  // 字段定义（用于表单等，列表使用自定义列）
  fields: {
    container_id: {
      key: 'container_id',
      label: '容器ID',
      type: 'text',
    },
    container_number: {
      key: 'container_number',
      label: '柜号',
      type: 'text',
      sortable: true,
    },
    mbl: {
      key: 'mbl',
      label: 'MBL',
      type: 'text',
      sortable: true,
    },
    port_location: {
      key: 'port_location',
      label: '码头/查验站',
      type: 'select',
    },
    customer: {
      key: 'customer',
      label: '客户',
      type: 'text',
      sortable: true,
    },
    container_type: {
      key: 'container_type',
      label: '柜型',
      type: 'text',
      sortable: true,
    },
    carrier: {
      key: 'carrier',
      label: '承运公司',
      type: 'select',
      sortable: true,
    },
    do_issued: {
      key: 'do_issued',
      label: 'DO',
      type: 'badge',
    },
    order_date: {
      key: 'order_date',
      label: '订单日期',
      type: 'date',
      sortable: true,
    },
    eta_date: {
      key: 'eta_date',
      label: 'ETA',
      type: 'date',
      sortable: true,
    },
    operation_mode: {
      key: 'operation_mode',
      label: '操作方式',
      type: 'select',
    },
    delivery_location: {
      key: 'delivery_location',
      label: '送货地',
      type: 'text',
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
    return_date: {
      key: 'return_date',
      label: '还柜日期',
      type: 'date',
      sortable: true,
    },
    appointment_number: {
      key: 'appointment_number',
      label: '预约号码',
      type: 'text',
    },
    appointment_time: {
      key: 'appointment_time',
      label: '预约时间',
      type: 'datetime',
      sortable: true,
    },
    warehouse_account: {
      key: 'warehouse_account',
      label: '约仓账号',
      type: 'text',
    },
  },
  
  list: {
    defaultSort: 'created_at',
    defaultOrder: 'desc',
    columns: [], // 使用自定义列，所以这里留空
    searchFields: ['container_number', 'mbl'], // 搜索订单号和MBL（在API中处理）
    pageSize: 20,
    // 行级编辑配置（点击小笔图标编辑，点击小磁盘保存）
    inlineEdit: {
      enabled: true,
      fields: [
        'port_location', // 码头/查验站（下拉菜单）
        'eta_date', // ETA日期（日期）
        'pickup_date', // 提柜日期（日期）
        'return_date', // 还柜日期（日期）
        'carrier', // 承运公司（下拉菜单）
        'operation_mode', // 操作方式（下拉菜单）
      ],
    },
    // 筛选配置（快速筛选）
    filterFields: [
      {
        field: 'port_location',
        label: '码头/查验站',
        type: 'select',
        // options 将在 wrapper 组件中动态加载
      },
      {
        field: 'eta_date',
        label: 'ETA日期',
        type: 'dateRange',
        dateFields: ['eta_date'],
      },
      {
        field: 'pickup_date',
        label: '提柜日期',
        type: 'dateRange',
        dateFields: ['pickup_date'],
      },
      {
        field: 'return_date',
        label: '还柜日期',
        type: 'dateRange',
        dateFields: ['return_deadline'],
      },
      {
        field: 'carrier',
        label: '承运公司',
        type: 'select',
        // options 将在 wrapper 组件中动态加载
      },
      {
        field: 'operation_mode',
        label: '操作方式',
        type: 'select',
        // options 将在 wrapper 组件中动态加载
      },
    ],
    // 高级搜索配置（多条件组合）
    advancedSearchFields: [
      {
        field: 'customer',
        label: '客户',
        type: 'text',
      },
      {
        field: 'port_location',
        label: '码头/查验站',
        type: 'text',
      },
      {
        field: 'operation_mode',
        label: '操作方式',
        type: 'text',
      },
      {
        field: 'delivery_location',
        label: '送货地',
        type: 'text',
      },
      {
        field: 'appointment_time',
        label: '预约时间',
        type: 'dateRange',
        dateFields: ['appointment_time'],
      },
    ],
  },
  
  formFields: [], // 海柜管理暂时不需要表单
  
  permissions: {
    list: ['admin', 'tms_manager', 'employee'],
    create: [], // 海柜数据来自订单，不允许创建
    update: ['admin', 'tms_manager'],
    delete: [], // 海柜数据来自订单，不允许在海柜管理中删除
  },
  
  // 海柜管理使用自定义API，不需要prisma配置
  prisma: undefined,
}

