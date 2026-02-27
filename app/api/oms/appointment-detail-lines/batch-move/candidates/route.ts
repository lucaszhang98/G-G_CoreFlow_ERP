/**
 * 批量转到其他预约 - 可选的目标预约列表
 * GET ?lineIds=1,2,3&currentAppointmentId=5
 * 返回：与选中第一条明细的仓点（目的地）相同，且送货时间晚于选中所有柜号拆柜时间的预约
 * 每条：仓点、预约号码、送货时间、已有板数
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { serializeBigInt } from '@/lib/api/helpers'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const lineIdsParam = searchParams.get('lineIds')
    const currentAppointmentId = searchParams.get('currentAppointmentId')

    if (!lineIdsParam || !currentAppointmentId) {
      return NextResponse.json({ error: '缺少 lineIds 或 currentAppointmentId' }, { status: 400 })
    }

    const lineIds = lineIdsParam.split(',').map((s) => s.trim()).filter(Boolean)
    if (lineIds.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    const bigIntLineIds = lineIds.map((id) => BigInt(id))
    const currentId = BigInt(currentAppointmentId)

    // 选中的明细及对应 order_detail（仓点、订单）
    const lines = await prisma.appointment_detail_lines.findMany({
      where: { id: { in: bigIntLineIds } },
      select: {
        id: true,
        order_detail_id: true,
        order_detail: {
          select: {
            delivery_location_id: true,
            order_id: true,
          },
        },
      },
    })

    if (lines.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    const firstLine = lines[0]
    const deliveryLocationId = firstLine.order_detail?.delivery_location_id ?? null
    if (deliveryLocationId == null) {
      return NextResponse.json({ success: true, data: [] })
    }

    const orderIds = [...new Set(lines.map((l) => l.order_detail?.order_id).filter(Boolean))] as bigint[]
    let maxUnloadAt: Date | null = null
    if (orderIds.length > 0) {
      const receipts = await prisma.inbound_receipt.findMany({
        where: { order_id: { in: orderIds } },
        select: { planned_unload_at: true },
      })
      for (const r of receipts) {
        if (r.planned_unload_at) {
          if (!maxUnloadAt || r.planned_unload_at > maxUnloadAt) {
            maxUnloadAt = r.planned_unload_at
          }
        }
      }
    }

    const raw = await prisma.delivery_appointments.findMany({
      where: {
        location_id: deliveryLocationId,
        appointment_id: { not: currentId },
        ...(maxUnloadAt
          ? {
              OR: [
                { confirmed_start: { gt: maxUnloadAt } },
                { confirmed_start: null, requested_start: { gt: maxUnloadAt } },
              ],
            }
          : {}),
      },
      select: {
        appointment_id: true,
        reference_number: true,
        confirmed_start: true,
        requested_start: true,
        total_pallets: true,
        locations: {
          select: {
            location_id: true,
            location_code: true,
            name: true,
          },
        },
      },
      orderBy: [{ confirmed_start: 'asc' }, { requested_start: 'asc' }],
    })

    const data = raw.map((row) => {
      const deliveryTime = row.confirmed_start ?? row.requested_start
      return {
        appointment_id: serializeBigInt(row.appointment_id),
        reference_number: row.reference_number ?? '',
        delivery_time: deliveryTime ? deliveryTime.toISOString() : null,
        total_pallets: row.total_pallets ?? 0,
        location_name: row.locations?.name ?? '',
        location_code: row.locations?.location_code ?? '',
      }
    })

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('获取可转移目标预约列表失败:', error)
    return NextResponse.json(
      { success: false, error: error.message || '获取列表失败' },
      { status: 500 }
    )
  }
}
