/**
 * 订单导入Service
 * 
 * 职责：
 * 1. 定义订单导入的配置
 * 2. 实现订单+订单明细的导入逻辑（一对多关系）
 * 3. 预加载并验证主数据（客户、位置）
 */

import prisma from '@/lib/prisma'
import { BaseImportService } from './import/base-import.service'
import { ImportConfig, ImportError } from './import/types'
import {
  orderImportRowSchema,
  OrderImportRow,
} from '@/lib/validations/order-import'

/**
 * 主数据（用于验证和关联）
 */
interface OrderMasterData {
  customerMap: Map<string, bigint>
  locationMap: Map<string, bigint>
}

/**
 * 订单导入配置
 */
const orderImportConfig: ImportConfig<OrderImportRow> = {
  // 1. 表头映射
  headerMap: {
    '订单号': 'order_number',
    '客户代码': 'customer_code',
    '负责人': 'user_id',
    '订单日期': 'order_date',
    '状态': 'status',
    '操作方式': 'operation_mode',
    '目的地': 'delivery_location_code',
    '订单金额': 'total_amount',
    '折扣金额': 'discount_amount',
    '税费': 'tax_amount',
    '最终金额': 'final_amount',
    '货柜类型': 'container_type',
    'ETA': 'eta_date',
    'LFD': 'lfd_date',
    '提柜日期': 'pickup_date',
    '就绪日期': 'ready_date',
    '归还截止日期': 'return_deadline',
    'MBL': 'mbl_number',
    'DO': 'do_issued',
    '备注': 'notes',
    '送仓地点': 'detail_delivery_location_code',
    '性质': 'delivery_nature',
    '数量': 'quantity',
    '体积': 'volume',
    'FBA': 'fba',
    '明细备注': 'detail_notes',
    'PO': 'po',
  },

  // 2. 验证Schema
  validationSchema: orderImportRowSchema,

  // 3. 权限要求
  requiredRoles: ['admin', 'oms_manager'],

  // 4. 预加载主数据
  loadMasterData: async (): Promise<OrderMasterData> => {
    const [customers, locations] = await Promise.all([
      prisma.customers.findMany({
        select: { id: true, code: true, name: true },
      }),
      prisma.locations.findMany({
        select: { location_id: true, location_code: true, name: true },
      }),
    ])

    return {
      customerMap: new Map(customers.map((c) => [c.code as string, c.id])),
      locationMap: new Map(locations.map((l) => [l.location_code as string, l.location_id])),
    }
  },

  // 5. 检查重复和数据一致性（整合所有验证）
  checkDuplicates: async (
    data: any[],
    masterData?: OrderMasterData
  ): Promise<ImportError[]> => {
    const errors: ImportError[] = []

    if (!masterData) {
      errors.push({
        row: 0,
        field: 'system',
        message: '主数据未加载',
      })
      return errors
    }

    const { customerMap, locationMap } = masterData

    // 第1步：主数据存在性校验
    data.forEach((row) => {
      // 检查客户代码
      if (!customerMap.has(row.customer_code)) {
        errors.push({
          row: row.rowIndex,
          field: '客户代码',
          message: `客户代码"${row.customer_code}"不存在`,
        })
      }

      // 检查目的地
      if (!locationMap.has(row.delivery_location_code)) {
        errors.push({
          row: row.rowIndex,
          field: '目的地',
          message: `位置代码"${row.delivery_location_code}"不存在`,
        })
      }

      // 检查送仓地点
      if (!locationMap.has(row.detail_delivery_location_code)) {
        errors.push({
          row: row.rowIndex,
          field: '送仓地点',
          message: `位置代码"${row.detail_delivery_location_code}"不存在`,
        })
      }
    })

    // 如果主数据验证失败，直接返回
    if (errors.length > 0) {
      return errors
    }

    // 第2步：按订单号分组
    const orderGroups = new Map<string, (OrderImportRow & { rowIndex: number })[]>()
    data.forEach((row) => {
      if (!orderGroups.has(row.order_number)) {
        orderGroups.set(row.order_number, [])
      }
      orderGroups.get(row.order_number)!.push(row)
    })

    // 第3步：检查同一订单的订单字段是否一致
    for (const [orderNumber, rows] of orderGroups) {
      if (rows.length > 1) {
        const first = rows[0]
        for (let i = 1; i < rows.length; i++) {
          const current = rows[i]

          // 检查关键订单字段是否一致
          const orderFields = [
            'customer_code',
            'order_date',
            'status',
            'operation_mode',
            'delivery_location_code',
            'container_type',
            'eta_date',
            'mbl_number',
            'do_issued',
          ] as const

          for (const field of orderFields) {
            if (first[field] !== current[field]) {
              errors.push({
                row: current.rowIndex,
                field: field,
                message: `订单号"${orderNumber}"的多行数据中，${field}字段不一致`,
              })
            }
          }
        }
      }
    }

    // 第4步：检查订单号是否已存在于数据库
    if (errors.length === 0) {
      const orderNumbers = Array.from(orderGroups.keys())
      const existingOrders = await prisma.orders.findMany({
        where: { order_number: { in: orderNumbers } },
        select: { order_number: true },
      })

      if (existingOrders.length > 0) {
        const existingNumbers = existingOrders.map((o) => o.order_number)
        existingNumbers.forEach((orderNumber) => {
          const firstRow = orderGroups.get(orderNumber)![0]
          errors.push({
            row: firstRow.rowIndex,
            field: 'order_number',
            message: `订单号"${orderNumber}"已存在，请勿重复导入`,
          })
        })
      }
    }

    return errors
  },

  // 6. 执行导入（核心业务逻辑）
  executeImport: async (
    data: any[],
    userId: bigint,
    masterData?: OrderMasterData
  ): Promise<void> => {
    if (!masterData) {
      throw new Error('主数据未加载')
    }

    const { customerMap, locationMap } = masterData

    // 按订单号分组
    const orderGroups = new Map<string, (OrderImportRow & { rowIndex: number })[]>()
    data.forEach((row) => {
      if (!orderGroups.has(row.order_number)) {
        orderGroups.set(row.order_number, [])
      }
      orderGroups.get(row.order_number)!.push(row)
    })

    // 使用事务批量导入（全部成功或全部失败）
    await prisma.$transaction(async (tx) => {
      for (const [orderNumber, rows] of orderGroups) {
        const firstRow = rows[0]

        // 创建订单
        const order = await tx.orders.create({
          data: {
            order_number: firstRow.order_number,
            customer_id: customerMap.get(firstRow.customer_code)!,
            order_date: new Date(firstRow.order_date),
            status: firstRow.status,
            operation_mode: firstRow.operation_mode,
            delivery_location_id: locationMap.get(firstRow.delivery_location_code)!,
            total_amount: firstRow.total_amount,
            discount_amount: firstRow.discount_amount,
            tax_amount: firstRow.tax_amount,
            final_amount: firstRow.final_amount,
            container_type: firstRow.container_type,
            eta_date: new Date(firstRow.eta_date),
            lfd_date: firstRow.lfd_date ? new Date(firstRow.lfd_date) : null,
            pickup_date: firstRow.pickup_date ? new Date(firstRow.pickup_date) : null,
            ready_date: firstRow.ready_date ? new Date(firstRow.ready_date) : null,
            return_deadline: firstRow.return_deadline
              ? new Date(firstRow.return_deadline)
              : null,
            mbl_number: firstRow.mbl_number,
            do_issued: firstRow.do_issued,
            notes: firstRow.notes || null,
            created_by: userId,
            updated_by: userId,
          },
        })

        // 创建订单明细
        for (const row of rows) {
          const volume = row.volume
          const estimatedPallets = Math.max(1, Math.round(volume / 2))

          await tx.order_detail.create({
            data: {
              order_id: order.order_id,
              quantity: row.quantity,
              volume: volume,
              estimated_pallets: estimatedPallets,
              remaining_pallets: estimatedPallets, // 初始未约板数 = 预计板数
              delivery_nature: row.delivery_nature,
              delivery_location: locationMap
                .get(row.detail_delivery_location_code)!
                .toString(),
              fba: row.fba || null,
              notes: row.detail_notes || null,
              po: row.po || null,
              created_by: userId,
              updated_by: userId,
            },
          })
        }
      }
    })
  },
}

/**
 * 导出订单导入Service实例
 */
export const orderImportService = new BaseImportService(orderImportConfig)


