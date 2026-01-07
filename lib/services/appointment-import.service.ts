/**
 * 预约导入Service
 * 
 * 职责：
 * 1. 定义预约导入的配置
 * 2. 实现预约+明细的导入逻辑
 * 3. 校验订单明细存在性
 * 4. 校验剩余板数（已入库/未入库不同逻辑）
 * 5. 扣减板数
 */

import prisma from '@/lib/prisma'
import { BaseImportService } from './import/base-import.service'
import { ImportConfig, ImportError } from './import/types'
import {
  appointmentImportRowSchema,
  AppointmentImportRow,
} from '@/lib/validations/appointment-import'
import { parseDateTimeAsUTC } from '@/lib/utils/datetime-pst'

/**
 * 主数据（用于验证和关联）
 */
interface AppointmentMasterData {
  ordersMap: Map<string, any>  // order_number -> order (with details)
  locationsMap: Map<string, bigint>  // location_code -> location_id
  inventoryMap: Map<bigint, any>  // order_detail_id -> inventory_lot
}

/**
 * 预约导入配置
 */
const appointmentImportConfig: ImportConfig<AppointmentImportRow> = {
  // 1. 表头映射
  headerMap: {
    '预约号码': 'reference_number',
    '订单号': 'order_number',
    '派送方式': 'delivery_method',
    '预约账号': 'appointment_account',
    '预约类型': 'appointment_type',
    '起始地': 'origin_location_code',
    '目的地': 'destination_location_code',
    '送货时间': 'confirmed_start',
    '拒收': 'rejected',
    'PO': 'po',
    '备注': 'notes',
    '仓点': 'detail_location_code',
    '性质': 'delivery_nature',
    '预计板数': 'estimated_pallets',
  },

  // 2. 验证Schema
  validationSchema: appointmentImportRowSchema,

  // 3. 权限要求
  requiredRoles: ['admin', 'oms_manager'],

  // 4. 预加载主数据
  loadMasterData: async (): Promise<AppointmentMasterData> => {
    console.log('[预约导入] 预加载主数据...')
    
    // 查订单（包含明细）
    const orders = await prisma.orders.findMany({
      select: {
        order_id: true,
        order_number: true,
        order_detail: {
          select: {
            id: true,
            order_id: true,
            delivery_location: true,
            delivery_nature: true,
            estimated_pallets: true,
            remaining_pallets: true,
          },
        },
      },
    })

    // 查位置
    const locations = await prisma.locations.findMany({
      select: {
        location_id: true,
        location_code: true,
      },
    })

    // 查所有订单明细的库存
    const allOrderDetailIds = orders.flatMap(o => 
      o.order_detail.map(od => od.id)
    )

    const inventoryLots = await prisma.inventory_lots.findMany({
      where: {
        order_detail_id: {
          in: allOrderDetailIds,
        },
      },
      select: {
        inventory_lot_id: true,
        order_detail_id: true,
        pallet_count: true,
        unbooked_pallet_count: true,
      },
    })

    // 构建Map
    const ordersMap = new Map(
      orders.map(o => [o.order_number as string, o])
    )

    const locationsMap = new Map(
      locations.map(l => [l.location_code as string, l.location_id])
    )

    const inventoryMap = new Map(
      inventoryLots.map(inv => [inv.order_detail_id, inv])
    )

    console.log(`[预约导入] 已加载 ${orders.length} 个订单，${locations.length} 个位置，${inventoryLots.length} 个库存记录`)

    return { ordersMap, locationsMap, inventoryMap }
  },

  // 5. 检查重复和业务校验
  checkDuplicates: async (
    data: any[],
    masterData?: AppointmentMasterData
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

    const { ordersMap, locationsMap, inventoryMap } = masterData

    // 第1步：验证每一行的基础数据
    const validatedRows: any[] = []
    
    data.forEach((row, index) => {
      const rowIndex = row.rowIndex || (index + 2) // 如果没有rowIndex，使用索引+2（Excel行号）

      // 1. 验证订单号是否存在
      if (!ordersMap.has(row.order_number)) {
        errors.push({
          row: rowIndex,
          field: '订单号',
          message: `订单号"${row.order_number}"不存在`,
        })
        return  // 订单不存在，后续校验无意义
      }

      // 2. 验证位置是否存在（起始地为可选字段）
      if (row.origin_location_code && !locationsMap.has(row.origin_location_code)) {
        errors.push({
          row: rowIndex,
          field: '起始地',
          message: `位置代码"${row.origin_location_code}"不存在`,
        })
      }

      if (!locationsMap.has(row.destination_location_code)) {
        errors.push({
          row: rowIndex,
          field: '目的地',
          message: `位置代码"${row.destination_location_code}"不存在`,
        })
      }

      if (!locationsMap.has(row.detail_location_code)) {
        errors.push({
          row: rowIndex,
          field: '仓点',
          message: `位置代码"${row.detail_location_code}"不存在`,
        })
        return  // 仓点不存在，后续校验无意义
      }

      // 3. 验证订单明细是否存在（订单号+仓点+性质）
      const order = ordersMap.get(row.order_number)!
      const detailLocationId = locationsMap.get(row.detail_location_code)!
      
      const orderDetail = order.order_detail.find(
        (od: any) =>
          od.delivery_location === detailLocationId.toString() &&
          od.delivery_nature === row.delivery_nature
      )

      if (!orderDetail) {
        errors.push({
          row: rowIndex,
          field: '仓点',
          message: `订单"${row.order_number}"中不存在仓点"${row.detail_location_code}"、性质"${row.delivery_nature}"的明细`,
        })
        return  // 明细不存在，后续校验无意义
      }

      // 记录找到的订单明细ID（用于后续累加检查）
      validatedRows.push({
        ...row,
        rowIndex,
        orderDetailId: orderDetail.id,
      })
    })

    // 如果基础验证失败，直接返回
    if (errors.length > 0) {
      return errors
    }

    // 第2步：按订单明细分组，累加预约板数（方案C：累加检查）
    const detailPalletsMap = new Map<bigint, { 
      totalBooked: number, 
      available: number, 
      rows: number[],
      detailKey: string 
    }>()

    validatedRows.forEach((row) => {
      const orderDetailId = row.orderDetailId
      
      if (!detailPalletsMap.has(orderDetailId)) {
        // 首次遇到这个订单明细，计算可用板数
        const inventory = inventoryMap.get(orderDetailId)
        const hasInventory = inventory && inventory.pallet_count > 0
        const order = ordersMap.get(row.order_number)
        const orderDetail = order.order_detail.find((od: any) => od.id === orderDetailId)
        
        const availablePallets = hasInventory
          ? (inventory.unbooked_pallet_count ?? inventory.pallet_count)
          : (orderDetail.remaining_pallets ?? orderDetail.estimated_pallets ?? 0)

        detailPalletsMap.set(orderDetailId, {
          totalBooked: 0,
          available: availablePallets,
          rows: [],
          detailKey: `${row.order_number}-${row.detail_location_code}-${row.delivery_nature}`
        })
      }

      // 累加预约板数
      const detailInfo = detailPalletsMap.get(orderDetailId)!
      detailInfo.totalBooked += row.estimated_pallets
      detailInfo.rows.push(row.rowIndex)
    })

    // 第3步：检查累加后的板数是否超过可用板数
    for (const [orderDetailId, info] of detailPalletsMap) {
      if (info.totalBooked > info.available) {
        errors.push({
          row: info.rows[0],  // 指向第一行
          field: '预计板数',
          message: `订单明细"${info.detailKey}"累计预约${info.totalBooked}板，超过可用的${info.available}板（涉及行号：${info.rows.join(', ')}）`,
        })
      } else {
        console.log(`[预约导入] 订单明细${info.detailKey}：累计预约${info.totalBooked}板 / 可用${info.available}板 ✅`)
      }
    }

    // 按预约号码分组
    const appointmentGroups = new Map<string, any[]>()
    data.forEach((row) => {
      if (!appointmentGroups.has(row.reference_number)) {
        appointmentGroups.set(row.reference_number, [])
      }
      appointmentGroups.get(row.reference_number)!.push(row)
    })

    // 检查同一预约的主表字段是否一致
    for (const [referenceNumber, rows] of appointmentGroups) {
      if (rows.length > 1) {
        const first = rows[0]
        for (let i = 1; i < rows.length; i++) {
          const current = rows[i]

          // 检查关键预约主表字段是否一致
          // 注意：order_number 不需要一致，因为一个预约可以包含多个订单的明细
          const appointmentFields = [
            'delivery_method',
            'appointment_account',
            'appointment_type',
            'origin_location_code',
            'destination_location_code',
            'confirmed_start',
            'rejected',
            'po',
            'notes',
          ] as const

          for (const field of appointmentFields) {
            if (first[field] !== current[field]) {
              errors.push({
                row: current.rowIndex,
                field: field,
                message: `预约号码"${referenceNumber}"的多行数据中，"${field}"字段不一致（第${first.rowIndex}行="${first[field]}"，第${current.rowIndex}行="${current[field]}"）`,
              })
            }
          }
        }
      }

      // 检查同一预约中，订单明细是否重复（订单号+仓点+性质必须唯一）
      const detailKeys = new Map<string, number>()  // 存储 key -> rowIndex
      rows.forEach((row) => {
        const detailKey = `${row.order_number}-${row.detail_location_code}-${row.delivery_nature}`
        if (detailKeys.has(detailKey)) {
          const firstRowIndex = detailKeys.get(detailKey)!
          errors.push({
            row: row.rowIndex,
            field: '订单明细',
            message: `预约"${referenceNumber}"中，订单明细（订单号=${row.order_number}，仓点=${row.detail_location_code}，性质=${row.delivery_nature}）重复（首次出现在第${firstRowIndex}行）`,
          })
        } else {
          detailKeys.set(detailKey, row.rowIndex)
        }
      })
    }

    // 检查预约号码是否已存在于数据库
    if (errors.length === 0) {
      const referenceNumbers = Array.from(appointmentGroups.keys())
      const existingAppointments = await prisma.delivery_appointments.findMany({
        where: { reference_number: { in: referenceNumbers } },
        select: { reference_number: true },
      })

      if (existingAppointments.length > 0) {
        const existingNumbers = existingAppointments.map((a) => a.reference_number)
        existingNumbers.forEach((num) => {
          const rowIndex = data.find((r) => r.reference_number === num)?.rowIndex || 0
          errors.push({
            row: rowIndex,
            field: '预约号码',
            message: `预约号码"${num}"已存在于系统中`,
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
    masterData?: AppointmentMasterData
  ): Promise<{ successCount: number }> => {
    if (!masterData) {
      throw new Error('主数据未加载')
    }

    const { ordersMap, locationsMap, inventoryMap } = masterData

    // 按预约号码分组（支持一个预约多个明细）
    const appointmentGroups = new Map<string, any[]>()
    data.forEach((row) => {
      if (!appointmentGroups.has(row.reference_number)) {
        appointmentGroups.set(row.reference_number, [])
      }
      appointmentGroups.get(row.reference_number)!.push(row)
    })

    console.log(`[预约导入] 共 ${appointmentGroups.size} 个预约，${data.length} 个明细`)

    let successCount = 0 // 记录成功创建的预约数量

    // 使用事务批量导入（全部成功或全部失败）
    await prisma.$transaction(async (tx) => {
      for (const [referenceNumber, rows] of appointmentGroups) {
        const firstRow = rows[0]

        // 获取位置ID（起始地为可选字段）
        const originLocationId = firstRow.origin_location_code 
          ? locationsMap.get(firstRow.origin_location_code) 
          : null
        
        // 如果提供了起始地但不存在，则报错
        if (firstRow.origin_location_code && !originLocationId) {
          throw new Error(`起始地"${firstRow.origin_location_code}"不存在`)
        }
        
        const destinationLocationId = locationsMap.get(firstRow.destination_location_code)
        if (!destinationLocationId) {
          throw new Error(`目的地"${firstRow.destination_location_code}"不存在`)
        }

        // 解析送货时间（使用系统的 UTC 解析函数，保持原始时间不做时区转换）
        if (!firstRow.confirmed_start) {
          throw new Error(`预约"${referenceNumber}"的送货时间为空`)
        }
        
        let confirmedStart: Date
        try {
          // 将 "YYYY-MM-DD HH:mm" 格式转换为 "YYYY-MM-DDTHH:mm"
          const timeString = String(firstRow.confirmed_start).replace(' ', 'T')
          confirmedStart = parseDateTimeAsUTC(timeString)
        } catch (error) {
          throw new Error(`预约"${referenceNumber}"的送货时间格式错误：${firstRow.confirmed_start}`)
        }

        // 创建预约主表（order_id 设置为 null，通过明细表关联订单）
        const appointment = await tx.delivery_appointments.create({
          data: {
            reference_number: firstRow.reference_number,
            order_id: null,  // ← 预约主表不直接关联订单
            origin_location_id: originLocationId,
            location_id: destinationLocationId,
            delivery_method: firstRow.delivery_method,
            appointment_account: firstRow.appointment_account,
            appointment_type: firstRow.appointment_type,
            confirmed_start: confirmedStart,
            requested_start: confirmedStart,  // 与confirmed_start相同
            status: 'requested',  // 默认状态
            rejected: firstRow.rejected,
            po: firstRow.po,
            notes: firstRow.notes,
            created_by: userId,
            updated_by: userId,
          },
        })

        console.log(`[预约导入] 创建预约：${referenceNumber}，共${rows.length}个明细`)
        successCount++ // 预约创建成功，计数+1

        // 创建预约明细
        for (const row of rows) {
          console.log(`[预约导入] 准备创建明细：预约=${referenceNumber}，订单=${row.order_number}，仓点=${row.detail_location_code}，性质=${row.delivery_nature}`)
          
          // 每个明细行需要从自己的订单中查找订单明细
          const rowOrder = ordersMap.get(row.order_number)
          if (!rowOrder) {
            throw new Error(`订单号"${row.order_number}"不存在`)
          }
          
          const detailLocationId = locationsMap.get(row.detail_location_code)
          if (!detailLocationId) {
            throw new Error(`仓点"${row.detail_location_code}"不存在`)
          }

          // 从当前行的订单中查找订单明细
          const orderDetail = rowOrder.order_detail.find(
            (od: any) =>
              od.delivery_location === detailLocationId.toString() &&
              od.delivery_nature === row.delivery_nature
          )

          if (!orderDetail) {
            throw new Error(
              `订单"${row.order_number}"中不存在仓点"${row.detail_location_code}"、性质"${row.delivery_nature}"的明细`
            )
          }
          
          console.log(`[预约导入] 找到订单明细：order=${row.order_number}, order_detail_id=${orderDetail.id}`)

          // 计算可用板数（用于快照）
          const inventory = inventoryMap.get(orderDetail.id)
          const hasInventory = inventory && inventory.pallet_count > 0
          const availablePallets = hasInventory
            ? (inventory.unbooked_pallet_count ?? inventory.pallet_count)
            : (orderDetail.remaining_pallets ?? orderDetail.estimated_pallets ?? 0)

          // 创建预约明细
          console.log(`[预约导入] 创建明细记录：appointment_id=${appointment.appointment_id}，order_detail_id=${orderDetail.id}`)
          await tx.appointment_detail_lines.create({
            data: {
              appointment_id: appointment.appointment_id,
              order_detail_id: orderDetail.id,
              estimated_pallets: row.estimated_pallets,
              total_pallets_at_time: availablePallets,  // 快照
            },
          })
          console.log(`[预约导入] 明细创建成功`)

          // 扣减板数
          if (hasInventory) {
            // 已入库：扣减库存的 unbooked_pallet_count
            await tx.inventory_lots.update({
              where: { inventory_lot_id: inventory.inventory_lot_id },
              data: {
                unbooked_pallet_count: {
                  decrement: row.estimated_pallets,
                },
              },
            })
            console.log(`[预约导入] 扣减库存：order=${row.order_number}, order_detail_id=${orderDetail.id}，扣减${row.estimated_pallets}板（unbooked_pallet_count）`)
          } else {
            // 未入库：扣减订单明细的 remaining_pallets
            await tx.order_detail.update({
              where: { id: orderDetail.id },
              data: {
                remaining_pallets: {
                  decrement: row.estimated_pallets,
                },
              },
            })
            console.log(`[预约导入] 扣减订单明细：order=${row.order_number}, order_detail_id=${orderDetail.id}，扣减${row.estimated_pallets}板（remaining_pallets）`)
          }
        }

        // 自动创建关联记录（与前端逻辑一致）
        // 如果是非直送，创建 outbound_shipments
        if (firstRow.delivery_method !== '直送') {
          try {
            const defaultWarehouseId = BigInt(1000)
            await tx.$executeRaw`
              INSERT INTO wms.outbound_shipments (warehouse_id, appointment_id, status, created_at, updated_at, created_by, updated_by)
              VALUES (${defaultWarehouseId}, ${appointment.appointment_id}, 'planned', NOW(), NOW(), ${userId}, ${userId})
              ON CONFLICT (appointment_id) DO NOTHING
            `
          } catch (error) {
            console.warn('[预约导入] 创建 outbound_shipments 失败（可能已存在）:', error)
          }
        }

        // 所有预约都创建 delivery_management
        try {
          await tx.$executeRaw`
            INSERT INTO tms.delivery_management (appointment_id, status, created_at, updated_at, created_by, updated_by)
            VALUES (${appointment.appointment_id}, 'pending', NOW(), NOW(), ${userId}, ${userId})
            ON CONFLICT (appointment_id) DO NOTHING
          `
        } catch (error) {
          console.warn('[预约导入] 创建 delivery_management 失败（可能已存在）:', error)
        }
      }
    })

    console.log(`[预约导入] 导入完成：${successCount} 个预约，${data.length} 个明细`)
    
    // 返回成功计数（通过抛出特殊对象传递给base-import-service）
    return { successCount }
  },
}

/**
 * 导出预约导入Service实例
 */
export const appointmentImportService = new BaseImportService(appointmentImportConfig)








