import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/api/helpers'
import prisma from '@/lib/prisma'

/**
 * 定时任务：更新所有库存记录的剩余板数
 * 有效占用 = estimated_pallets - rejected_pallets
 * 剩余板数 = 实际板数 - 所有已过期预约的有效占用之和
 * 判断过期：confirmed_start < 当前日期
 */
export async function POST(request: NextRequest) {
  try {
    // 验证权限（可选：可以添加管理员权限检查）
    const authResult = await checkAuth()
    if (authResult.error) {
      return authResult.error
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 获取所有库存记录
    const inventoryLots = await prisma.inventory_lots.findMany({
      select: {
        inventory_lot_id: true,
        order_detail_id: true,
        pallet_count: true,
      },
    })

    let updatedCount = 0
    let errorCount = 0

    // 批量更新每个库存记录
    for (const lot of inventoryLots) {
      try {
        const expiredAppointmentLines = await prisma.appointment_detail_lines.findMany({
          where: {
            order_detail_id: lot.order_detail_id,
            delivery_appointments: { confirmed_start: { lt: today } },
          },
          select: { estimated_pallets: true, rejected_pallets: true },
        })
        const effective = (est: number, rej?: number | null) => (est || 0) - (rej ?? 0)
        const totalExpiredEffective = expiredAppointmentLines.reduce((sum, line) => sum + effective(line.estimated_pallets, line.rejected_pallets), 0)
        const newRemainingPalletCount = lot.pallet_count - totalExpiredEffective

        // 更新库存记录
        await prisma.inventory_lots.update({
          where: { inventory_lot_id: lot.inventory_lot_id },
          data: { remaining_pallet_count: newRemainingPalletCount },
        })

        updatedCount++
      } catch (error: any) {
        console.error(`更新库存记录 ${lot.inventory_lot_id} 失败:`, error)
        errorCount++
      }
    }

    return NextResponse.json({
      success: true,
      message: `定时任务执行完成：成功更新 ${updatedCount} 条记录，失败 ${errorCount} 条记录`,
      updated: updatedCount,
      errors: errorCount,
    })
  } catch (error: any) {
    console.error('定时任务执行失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || '定时任务执行失败',
      },
      { status: 500 }
    )
  }
}

/**
 * GET - 手动触发定时任务（用于测试）
 */
export async function GET(request: NextRequest) {
  return POST(request)
}

