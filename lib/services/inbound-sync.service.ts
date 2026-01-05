/**
 * 入库管理自动同步Service
 * 
 * 职责：
 * 1. 当订单的 operation_mode 为 'warehouse' 时，自动创建对应的 inbound_receipt 记录
 * 2. 确保 orders 和 inbound_receipt 的一对一关系
 */

import prisma from '@/lib/prisma'

export interface InboundSyncResult {
  success: boolean
  created?: boolean
  inboundReceiptId?: bigint
  message?: string
  error?: string
}

/**
 * 为指定订单创建入库管理记录
 * 
 * @param orderId 订单ID
 * @param userId 创建用户ID（可选）
 * @returns 同步结果
 */
export async function syncInboundReceiptForOrder(
  orderId: bigint,
  userId?: bigint
): Promise<InboundSyncResult> {
  try {
    // 1. 检查订单是否存在
    const order = await prisma.orders.findUnique({
      where: { order_id: orderId },
      select: {
        order_id: true,
        operation_mode: true,
        inbound_receipt: {
          select: { inbound_receipt_id: true },
        },
      },
    })

    if (!order) {
      return {
        success: false,
        error: `订单不存在: ${orderId}`,
      }
    }

    // 2. 检查 operation_mode 是否为 unload（拆柜）
    if (order.operation_mode !== 'unload') {
      return {
        success: true,
        created: false,
        message: `订单 ${orderId} 的 operation_mode 不是 unload，无需创建入库管理记录`,
      }
    }

    // 3. 检查是否已存在 inbound_receipt
    if (order.inbound_receipt) {
      return {
        success: true,
        created: false,
        inboundReceiptId: order.inbound_receipt.inbound_receipt_id,
        message: `订单 ${orderId} 已存在入库管理记录`,
      }
    }

    // 4. 获取默认仓库（取第一个可用仓库）
    const defaultWarehouse = await prisma.warehouses.findFirst({
      select: { warehouse_id: true },
      orderBy: { warehouse_id: 'asc' },
    })

    if (!defaultWarehouse) {
      return {
        success: false,
        error: '系统中没有可用的仓库，无法创建入库管理记录',
      }
    }

    // 5. 创建 inbound_receipt
    const inboundReceipt = await prisma.inbound_receipt.create({
      data: {
        order_id: orderId,
        warehouse_id: defaultWarehouse.warehouse_id,
        status: 'pending',
        planned_unload_at: null,
        unload_method_code: null,
        created_by: userId || undefined,
        updated_by: userId || undefined,
      },
    })

    return {
      success: true,
      created: true,
      inboundReceiptId: inboundReceipt.inbound_receipt_id,
      message: `成功为订单 ${orderId} 创建入库管理记录`,
    }
  } catch (error: any) {
    console.error('[InboundSync] 同步失败:', error)
    return {
      success: false,
      error: error.message || '创建入库管理记录失败',
    }
  }
}

/**
 * 批量同步多个订单的入库管理记录
 * 
 * @param orderIds 订单ID数组
 * @param userId 创建用户ID（可选）
 * @returns 同步结果统计
 */
export async function syncInboundReceiptsForOrders(
  orderIds: bigint[],
  userId?: bigint
): Promise<{
  success: boolean
  total: number
  created: number
  skipped: number
  errors: number
  errorMessages: string[]
}> {
  const results = {
    success: true,
    total: orderIds.length,
    created: 0,
    skipped: 0,
    errors: 0,
    errorMessages: [] as string[],
  }

  for (const orderId of orderIds) {
    const result = await syncInboundReceiptForOrder(orderId, userId)
    
    if (result.success) {
      if (result.created) {
        results.created++
      } else {
        results.skipped++
      }
    } else {
      results.errors++
      results.errorMessages.push(result.error || `订单 ${orderId} 同步失败`)
    }
  }

  results.success = results.errors === 0

  return results
}

/**
 * 同步所有缺失的入库管理记录
 * 查找所有 operation_mode = 'unload'（拆柜）但没有 inbound_receipt 的订单
 * 
 * @param userId 创建用户ID（可选）
 * @returns 同步结果统计
 */
export async function syncAllMissingInboundReceipts(
  userId?: bigint
): Promise<{
  success: boolean
  total: number
  created: number
  errors: number
  errorMessages: string[]
}> {
  try {
    // 查找所有需要同步的订单
    const ordersToSync = await prisma.orders.findMany({
      where: {
        operation_mode: 'unload',
        inbound_receipt: null,
      },
      select: {
        order_id: true,
      },
    })

    console.log(`[InboundSync] 找到 ${ordersToSync.length} 个需要同步的订单`)

    const orderIds = ordersToSync.map(o => o.order_id)
    const result = await syncInboundReceiptsForOrders(orderIds, userId)

    return {
      success: result.success,
      total: result.total,
      created: result.created,
      errors: result.errors,
      errorMessages: result.errorMessages,
    }
  } catch (error: any) {
    console.error('[InboundSync] 批量同步失败:', error)
    return {
      success: false,
      total: 0,
      created: 0,
      errors: 1,
      errorMessages: [error.message || '批量同步失败'],
    }
  }
}

export const inboundSyncService = {
  syncInboundReceiptForOrder,
  syncInboundReceiptsForOrders,
  syncAllMissingInboundReceipts,
}

