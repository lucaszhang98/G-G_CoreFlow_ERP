import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkPermission, addSystemFields } from '@/lib/api/helpers'
import prisma from '@/lib/prisma'
import { pickupManagementConfig } from '@/lib/crud/configs/pickup-management'

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        pickup_id: z.string().min(1),
        port_location_id: z.string().nullable(),
      })
    )
    .min(1),
})

/**
 * POST /api/tms/pickup-management/batch-save-port-locations
 * 批量保存本页手改的码头/查验站（写入 orders.port_location_id）
 */
export async function POST(request: NextRequest) {
  try {
    const permissionResult = await checkPermission(pickupManagementConfig.permissions.update)
    if (permissionResult.error) return permissionResult.error

    const json = await request.json()
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: '请求体无效', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { items } = parsed.data
    const user = permissionResult.user || null

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const pickup = await tx.pickup_management.findUnique({
          where: { pickup_id: BigInt(item.pickup_id) },
          select: { order_id: true },
        })
        if (!pickup) {
          throw new Error(`提柜记录不存在: ${item.pickup_id}`)
        }
        const orderUpdateData: { port_location_id: bigint | null } = {
          port_location_id: item.port_location_id ? BigInt(item.port_location_id) : null,
        }
        await addSystemFields(orderUpdateData, user, false)
        await tx.orders.update({
          where: { order_id: pickup.order_id },
          data: orderUpdateData,
        })
      }
    })

    return NextResponse.json({ success: true, updated: items.length })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '保存失败'
    console.error('[batch-save-port-locations]', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
