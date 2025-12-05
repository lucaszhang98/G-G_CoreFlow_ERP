import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/api/helpers'
import prisma from '@/lib/prisma'

// GET - 获取订单的明细和库存信息
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> | { orderId: string } }
) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    const resolvedParams = await Promise.resolve(params)
    const orderId = BigInt(resolvedParams.orderId)

    // 获取订单信息
    const order = await prisma.orders.findUnique({
      where: { order_id: orderId },
      select: {
        order_id: true,
        order_number: true,
        delivery_location: true,
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: '订单不存在' },
        { status: 404 }
      )
    }

    // 获取订单明细
    const orderDetails = await prisma.order_detail.findMany({
      where: { order_id: orderId },
      select: {
        id: true,
        quantity: true,
        volume: true,
        estimated_pallets: true,
        remaining_pallets: true, // 剩余板数
        delivery_nature: true,
        delivery_location: true,
        unload_type: true,
        volume_percentage: true,
        notes: true,
        po: true, // PO字段
        order_detail_item_order_detail_item_detail_idToorder_detail: {
          select: {
            id: true,
            detail_name: true,
          },
          take: 1,
        },
      },
    })

    // 获取所有 delivery_location 的 location_id（如果 delivery_location 是 location_id）
    const deliveryLocationIds = orderDetails
      .map(d => d.delivery_location)
      .filter((loc): loc is string => !!loc && !isNaN(Number(loc)))
      .map(loc => BigInt(loc))
    
    // 批量查询 locations 获取 location_code
    const locationsMap = new Map<string, string>()
    if (deliveryLocationIds.length > 0) {
      const locations = await prisma.locations.findMany({
        where: {
          location_id: {
            in: deliveryLocationIds,
          },
        },
        select: {
          location_id: true,
          location_code: true,
        },
      })
      locations.forEach(loc => {
        locationsMap.set(loc.location_id.toString(), loc.location_code || '')
      })
    }

    // 检查每个明细是否在库存中，并获取库存板数
    const detailsWithInventory = await Promise.all(
      orderDetails.map(async (detail) => {
        // 查询该明细的库存
        const inventoryLots = await prisma.inventory_lots.findMany({
          where: {
            order_id: orderId,
            order_detail_id: detail.id,
          },
          select: {
            pallet_count: true,
            unbooked_pallet_count: true, // 未约板数
            remaining_pallet_count: true,
          },
        })

        // 计算总库存板数
        const totalInventoryPallets = inventoryLots.reduce(
          (sum, lot) => sum + (Number(lot.pallet_count) || 0),
          0
        )

        const hasInventory = inventoryLots.length > 0 && totalInventoryPallets > 0

        // 确定总板数：已入库使用 unbooked_pallet_count，未入库使用 remaining_pallets
        // 如果有多个库存记录，使用第一个的 unbooked_pallet_count（通常一个明细只有一个库存记录）
        const totalPallets = hasInventory && inventoryLots.length > 0
          ? (inventoryLots[0].unbooked_pallet_count ?? inventoryLots[0].pallet_count ?? 0)
          : (detail.remaining_pallets ?? detail.estimated_pallets ?? 0)

        // 获取 location_code：如果 delivery_location 是 location_id，从 locationsMap 获取；否则直接使用 delivery_location（可能是 location_code）
        let locationCode = null
        if (detail.delivery_location) {
          if (locationsMap.has(detail.delivery_location)) {
            locationCode = locationsMap.get(detail.delivery_location) || null
          } else {
            // 如果不在 map 中，可能是 location_code 字符串，直接使用
            locationCode = detail.delivery_location
          }
        }

        return {
          id: detail.id.toString(),
          quantity: detail.quantity,
          volume: detail.volume ? Number(detail.volume) : null,
          estimated_pallets: detail.estimated_pallets,
          remaining_pallets: totalPallets, // 总板数（已入库用 unbooked_pallet_count，未入库用 remaining_pallets）
          delivery_nature: detail.delivery_nature,
          delivery_location: detail.delivery_location || null,
          location_code: locationCode, // 新增：location_code
          unload_type: detail.unload_type || null,
          volume_percentage: detail.volume_percentage ? Number(detail.volume_percentage) : null,
          notes: detail.notes || null,
          po: detail.po || null, // PO字段
          has_inventory: hasInventory,
          inventory_pallets: hasInventory ? totalInventoryPallets : null,
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: {
        order: {
          order_id: order.order_id.toString(),
          order_number: order.order_number,
          delivery_location: order.delivery_location,
        },
        details: detailsWithInventory,
      },
    })
  } catch (error: any) {
    console.error('获取订单明细失败:', error)
    return NextResponse.json(
      { error: '获取订单明细失败', message: error.message },
      { status: 500 }
    )
  }
}

