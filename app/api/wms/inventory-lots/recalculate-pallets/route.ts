/**
 * 批量重新计算所有库存记录的未约板数和剩余板数
 * 有效占用 = estimated_pallets - rejected_pallets
 * - unbooked_pallet_count = pallet_count - 所有有效占用之和
 * - remaining_pallet_count = pallet_count - 所有已过期预约的有效占用之和
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { serializeBigInt } from "@/lib/api/helpers"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    console.log("[批量修复] 开始重新计算所有库存记录的未约板数和剩余板数...")

    // 获取所有库存记录
    const inventoryLots = await prisma.inventory_lots.findMany({
      select: {
        inventory_lot_id: true,
        order_detail_id: true,
        pallet_count: true,
      },
    })

    console.log(`[批量修复] 找到 ${inventoryLots.length} 条库存记录`)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let successCount = 0
    let errorCount = 0
    const errors: string[] = []

    // 批量处理
    for (const lot of inventoryLots) {
      try {
        const allAppointmentLines = await prisma.appointment_detail_lines.findMany({
          where: { order_detail_id: lot.order_detail_id },
          select: {
            estimated_pallets: true,
            rejected_pallets: true,
            delivery_appointments: { select: { confirmed_start: true } },
          } as import('@prisma/client').Prisma.appointment_detail_linesSelect,
        })
        type LineWithRej = { estimated_pallets: number; rejected_pallets?: number | null; delivery_appointments?: { confirmed_start: Date | null } | null }
        const effective = (est: number, rej?: number | null) => (est || 0) - (rej ?? 0)
        const totalEffectivePallets = allAppointmentLines.reduce((sum, line) => sum + effective(line.estimated_pallets, (line as LineWithRej).rejected_pallets), 0)
        const totalExpiredEffectivePallets = allAppointmentLines.reduce((sum, line) => {
          const start = (line as LineWithRej).delivery_appointments?.confirmed_start
          if (!start) return sum
          const d = new Date(start)
          d.setHours(0, 0, 0, 0)
          if (d < today) return sum + effective(line.estimated_pallets, (line as LineWithRej).rejected_pallets)
          return sum
        }, 0)

        const newUnbookedCount = lot.pallet_count - totalEffectivePallets
        const newRemainingCount = lot.pallet_count - totalExpiredEffectivePallets

        // 更新记录
        await prisma.inventory_lots.update({
          where: { inventory_lot_id: lot.inventory_lot_id },
          data: {
            unbooked_pallet_count: newUnbookedCount,
            remaining_pallet_count: newRemainingCount,
          },
        })

        successCount++
      } catch (error: any) {
        errorCount++
        const errorMsg = `库存记录 ${lot.inventory_lot_id} 更新失败: ${error.message}`
        errors.push(errorMsg)
        console.error(`[批量修复] ${errorMsg}`)
      }
    }

    console.log(`[批量修复] 完成：成功 ${successCount} 条，失败 ${errorCount} 条`)

    return NextResponse.json({
      success: true,
      message: `批量修复完成：成功更新 ${successCount} 条记录，失败 ${errorCount} 条记录`,
      total: inventoryLots.length,
      successCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    console.error("[批量修复] 执行失败:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || "批量修复失败",
      },
      { status: 500 }
    )
  }
}

/**
 * GET - 手动触发批量修复（用于测试）
 */
export async function GET(request: NextRequest) {
  return POST(request)
}

