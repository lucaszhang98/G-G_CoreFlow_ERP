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
    order_id: {
      key: 'order_id',
      label: '订单ID',
      type: 'text',
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
    user_id: {
      key: 'user_id',
      label: '用户ID',
      type: 'number',
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
    created_at: {
      key: 'created_at',
      label: '创建时间',
      type: 'date',
      sortable: true,
    },
    updated_at: {
      key: 'updated_at',
      label: '更新时间',
      type: 'date',
      sortable: true,
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
      type: 'text',
    },
    weight: {
      key: 'weight',
      label: '重量',
      type: 'number',
    },
    mbl_number: {
      key: 'mbl_number',
      label: 'MBL号码',
      type: 'text',
    },
    do_issued: {
      key: 'do_issued',
      label: 'DO已签发',
      type: 'badge',
      options: [
        { label: '是', value: 'true' },
        { label: '否', value: 'false' },
      ],
    },
    warehouse_account: {
      key: 'warehouse_account',
      label: '仓库账户',
      type: 'text',
    },
    container_number: {
      key: 'container_number',
      label: '柜号',
      type: 'text',
    },
    appointment_time: {
      key: 'appointment_time',
      label: '预约时间',
      type: 'date',
    },
    port_location: {
      key: 'port_location',
      label: '码头/查验站',
      type: 'text',
    },
    operation_mode: {
      key: 'operation_mode',
      label: '操作方式',
      type: 'text',
    },
    delivery_location: {
      key: 'delivery_location',
      label: '送货地',
      type: 'text',
    },
    carrier_id: {
      key: 'carrier_id',
      label: '承运公司ID',
      type: 'number',
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
    created_by: {
      key: 'created_by',
      label: '创建人ID',
      type: 'number',
    },
    updated_by: {
      key: 'updated_by',
      label: '更新人ID',
      type: 'number',
    },
  },
  
  list: {
    defaultSort: 'order_date',
    defaultOrder: 'desc',
    columns: ['order_id', 'order_number', 'customer', 'user_id', 'order_date', 'status', 'total_amount', 'discount_amount', 'tax_amount', 'final_amount', 'container_type', 'weight', 'eta_date', 'lfd_date', 'pickup_date', 'ready_date', 'return_deadline', 'mbl_number', 'do_issued', 'warehouse_account', 'container_number', 'appointment_time', 'port_location', 'operation_mode', 'delivery_location', 'carrier_id', 'created_by', 'updated_by', 'created_at', 'updated_at'],
    searchFields: ['order_number', 'mbl_number'],
    pageSize: 10,
  },
  
  formFields: ['order_number', 'customer_id', 'order_date', 'status', 'total_amount', 'container_type', 'notes'],
  
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
    },
  },
}

