/**
 * 拆柜账单实体配置 - 数据来自入库管理，每条入库单一条
 */

import { EntityConfig } from '../types';

export const unloadBillConfig: EntityConfig = {
  name: 'unload_bill',
  displayName: '拆柜账单',
  pluralName: '拆柜账单',

  apiPath: '/api/wms/unload-bills',
  detailPath: '/dashboard/wms/inbound-receipts',
  idField: 'inbound_receipt_id',

  schemaName: 'unload_bill',

  fields: {
    unload_bill_id: {
      key: 'unload_bill_id',
      label: '账单ID',
      type: 'text',
      hidden: true,
    },
    inbound_receipt_id: {
      key: 'inbound_receipt_id',
      label: '入库单ID',
      type: 'text',
      hidden: true,
    },
    container_number: {
      key: 'container_number',
      label: '柜号',
      type: 'text',
      sortable: true,
      searchable: true,
    },
    total_box_count: {
      key: 'total_box_count',
      label: '总箱数',
      type: 'number',
    },
    planned_unload_at: {
      key: 'planned_unload_at',
      label: '拆柜日期',
      type: 'date',
      sortable: true,
    },
    amount: {
      key: 'amount',
      label: '价格',
      type: 'currency',
      sortable: true,
    },
    unloaded_by_id: {
      key: 'unloaded_by_id',
      label: '拆柜人员ID',
      type: 'text',
      hidden: true,
    },
    unloaded_by_name: {
      key: 'unloaded_by_name',
      label: '拆柜人员',
      type: 'text',
      sortable: true,
    },
  },

  list: {
    defaultSort: 'planned_unload_at',
    defaultOrder: 'desc',
    pageSize: 20,
    columns: ['container_number', 'total_box_count', 'planned_unload_at', 'amount', 'unloaded_by_name'],
    searchFields: ['container_number', 'unloaded_by_name'],
    filterFields: [
      {
        field: 'planned_unload_at',
        label: '拆柜日期',
        type: 'dateRange',
        dateFields: ['planned_unload_at'],
      },
      {
        field: 'unloaded_by',
        label: '拆柜人员',
        type: 'relation',
        relation: {
          model: 'users',
          displayField: 'full_name',
          valueField: 'id',
        },
      },
    ],
    batchOperations: {
      enabled: true,
      edit: {
        enabled: true,
        fields: ['amount'],
      },
      delete: { enabled: false },
    },
    inlineEdit: {
      enabled: true,
      fields: ['amount'],
    },
  },

  formFields: ['container_number', 'planned_unload_at', 'amount', 'unloaded_by_name'],

  permissions: {
    list: ['admin', 'wms_manager', 'tms_manager', 'employee', 'user', 'oms_operator', 'wms_operator'],
    create: [], // 数据来自入库管理，不在此创建
    update: ['admin', 'wms_manager', 'oms_operator', 'wms_operator'],
    delete: ['admin', 'wms_manager'],
  },
};
