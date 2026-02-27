/**
 * 批量修复入库管理拆柜日期 API
 * 
 * 为拆柜日期为空且未录入拆柜人员的记录重新计算拆柜日期（根据 pickup_date / eta_date）。
 * 拆柜人员有值的行视为已录入，不再参与计算。
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/api/helpers'
import prisma from '@/lib/prisma'
import { calculateUnloadDate } from '@/lib/utils/calculate-unload-date'

/**
 * POST /api/wms/inbound-receipts/fix-planned-unload-dates
 * 批量修复拆柜日期为空的入库管理记录（排除已填拆柜人员的记录）
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    // 只修复：拆柜日期为空 且 拆柜人员为空（拆柜人员有值视为已录入，不再计算）
    const inboundReceipts = await prisma.inbound_receipt.findMany({
      where: {
        planned_unload_at: null,
        unloaded_by: null,
      },
      include: {
        orders: {
          select: {
            order_id: true,
            order_number: true,
            pickup_date: true,
            eta_date: true,
          },
        },
      },
    })

    if (inboundReceipts.length === 0) {
      return NextResponse.json({
        success: true,
        message: '没有需要修复的记录',
        fixed: 0,
        failed: 0,
        errors: [],
      })
    }

    const results = {
      fixed: 0,
      failed: 0,
      errors: [] as Array<{ inbound_receipt_id: string; order_number: string; error: string }>,
    }

    // 批量处理每个记录
    for (const receipt of inboundReceipts) {
      try {
        // 计算拆柜日期
        const calculatedUnloadDate = calculateUnloadDate(
          receipt.orders.pickup_date,
          receipt.orders.eta_date
        )

        if (calculatedUnloadDate) {
          // 更新拆柜日期
          await prisma.inbound_receipt.update({
            where: { inbound_receipt_id: receipt.inbound_receipt_id },
            data: {
              planned_unload_at: calculatedUnloadDate,
              updated_at: new Date(),
            },
          })
          results.fixed++
        } else {
          // 无法计算（订单没有 pickup_date 和 eta_date）
          results.failed++
          results.errors.push({
            inbound_receipt_id: String(receipt.inbound_receipt_id),
            order_number: receipt.orders.order_number || '未知',
            error: '订单缺少提柜日期和到港日期，无法计算拆柜日期',
          })
        }
      } catch (error: any) {
        results.failed++
        results.errors.push({
          inbound_receipt_id: String(receipt.inbound_receipt_id),
          order_number: receipt.orders.order_number || '未知',
          error: error.message || '更新失败',
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `修复完成：成功 ${results.fixed} 条，失败 ${results.failed} 条`,
      fixed: results.fixed,
      failed: results.failed,
      total: inboundReceipts.length,
      errors: results.errors,
    })
  } catch (error: any) {
    console.error('批量修复拆柜日期失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || '批量修复拆柜日期失败',
      },
      { status: 500 }
    )
  }
}

