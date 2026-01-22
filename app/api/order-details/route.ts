import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { serializeBigInt } from '@/lib/api/helpers'

// GET - 获取仓点明细列表（支持 orderId 查询参数）
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('orderId')

    if (!orderId) {
      return NextResponse.json({ error: '缺少 orderId 参数' }, { status: 400 })
    }

    // 获取订单的所有明细
    const orderDetails = await prisma.order_detail.findMany({
      where: {
        order_id: BigInt(orderId),
      },
      select: {
        id: true,
        order_id: true,
        detail_id: true,
        quantity: true,
        volume: true,
        estimated_pallets: true,
        remaining_pallets: true, // 剩余板数
        delivery_nature: true,
        delivery_location_id: true,
        locations_order_detail_delivery_location_idTolocations: {
          select: {
            location_id: true,
            location_code: true,
            name: true,
          },
        },
        fba: true,
        volume_percentage: true,
        notes: true,
        po: true,
        window_period: true,
        created_at: true,
        updated_at: true,
        created_by: true,
        updated_by: true,
        order_detail_item_order_detail_item_detail_idToorder_detail: {
          select: {
            id: true,
            detail_name: true,
            sku: true,
            description: true,
          },
        },
      },
      orderBy: {
        volume_percentage: 'desc', // 按分仓占比降序排列
      },
    })

    // delivery_location_id 现在有外键约束，关联数据通过 Prisma include 自动加载
    // 不需要手动查询 locations 了

    // 序列化并格式化数据
    const serializedDetails = orderDetails.map(detail => {
      const serialized = serializeBigInt(detail)
      // 从关联数据中获取 location_code
      const locationCode = serialized.locations_order_detail_delivery_location_idTolocations?.location_code || null

      return {
        ...serialized,
        // 使用 location_code 作为 delivery_location（用于显示）
        delivery_location: locationCode,
        delivery_location_code: locationCode, // 添加 location_code 字段（备用）
      }
    })

    return NextResponse.json({
      success: true,
      data: serializedDetails,
    })
  } catch (error: any) {
    console.error('获取仓点明细失败:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || '获取仓点明细失败' 
      },
      { status: 500 }
    )
  }
}

// POST - 创建仓点明细
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const body = await request.json()
    const { order_id, quantity, volume, delivery_nature, delivery_location, fba, notes, po, window_period, estimated_pallets } = body

    // 验证和转换 delivery_location：如果是 location_code，转换为 location_id
    // delivery_location 现在应该是 location_id（BigInt）或 location_code（string）
    let validatedDeliveryLocationId: bigint | null = null
    if (delivery_location) {
      const locStr = String(delivery_location)
      // 如果是数字字符串，直接使用（location_id）
      if (/^\d+$/.test(locStr)) {
        validatedDeliveryLocationId = BigInt(locStr)
      } else {
        // 如果是 location_code，查询对应的 location_id
        const location = await prisma.locations.findFirst({
          where: { location_code: locStr },
          select: { location_id: true },
        })
        if (location) {
          validatedDeliveryLocationId = location.location_id
        } else {
          // 如果找不到对应的 location，返回错误
          return NextResponse.json(
            { error: `无效的送仓地点: ${locStr}` },
            { status: 400 }
          )
        }
      }
    }

    // 计算预计板数：如果用户没有输入，则根据体积除以2后四舍五入，最小值为1
    const volumeNum = volume ? parseFloat(volume) : 0
    const calculatedEstimatedPallets = estimated_pallets !== undefined && estimated_pallets !== null 
      ? parseInt(estimated_pallets) 
      : (volumeNum > 0 ? Math.max(1, Math.round(volumeNum / 2)) : null)

    // 计算分仓占比：需要先获取订单的总体积
    const order = await prisma.orders.findUnique({
      where: { order_id: BigInt(order_id) },
      include: {
        order_detail: {
          select: { volume: true },
        },
      },
    })
    
    // 计算当前订单的总体积（包括即将添加的明细）
    const existingTotalVolume = order?.order_detail?.reduce((sum: number, detail: any) => {
      const vol = detail.volume ? Number(detail.volume) : 0
      return sum + vol
    }, 0) || 0
    const newTotalVolume = existingTotalVolume + volumeNum
    const calculatedVolumePercentage = newTotalVolume > 0 ? (volumeNum / newTotalVolume) * 100 : null

    const orderDetail = await prisma.order_detail.create({
      data: {
        order_id: BigInt(order_id), // 直接使用 order_id 字段
        quantity: quantity || 0,
        volume: volumeNum || null,
        estimated_pallets: calculatedEstimatedPallets, // 自动计算
        remaining_pallets: calculatedEstimatedPallets, // 初始化未约板数 = 预计板数（还没有预约）
        delivery_nature: delivery_nature || null,
        delivery_location_id: validatedDeliveryLocationId,
        fba: fba || null,
        volume_percentage: calculatedVolumePercentage ? parseFloat(calculatedVolumePercentage.toFixed(2)) : null, // 自动计算，保留2位小数
        notes: notes || null,
        po: po || null,
        window_period: window_period || null,
        created_by: session.user.id ? BigInt(session.user.id) : null,
        updated_by: session.user.id ? BigInt(session.user.id) : null,
      },
    })

    // 创建明细后，重新计算该订单所有明细的分仓占比，并更新订单的 container_volume
    const updatedOrder = await prisma.orders.findUnique({
      where: { order_id: BigInt(order_id) },
      select: {
        order_id: true,
        order_detail: {
          select: { id: true, volume: true },
        },
      },
    })

    if (updatedOrder?.order_detail) {
      // 计算总体积
      const totalVolume = updatedOrder.order_detail.reduce((sum: number, detail: any) => {
        const vol = detail.volume ? Number(detail.volume) : 0
        return sum + vol
      }, 0)

      // 更新所有明细的 volume_percentage
      if (totalVolume > 0) {
        await Promise.all(
          updatedOrder.order_detail.map((detail: any) => {
            const vol = detail.volume ? Number(detail.volume) : 0
            const percentage = vol > 0 ? parseFloat(((vol / totalVolume) * 100).toFixed(2)) : null
            return prisma.order_detail.update({
              where: { id: detail.id },
              data: { volume_percentage: percentage },
            })
          })
        )
      }
      
      // 更新订单的 container_volume
      await prisma.orders.update({
        where: { order_id: BigInt(order_id) },
        data: { container_volume: totalVolume },
      })
    }

    return NextResponse.json(
      { data: serializeBigInt(orderDetail) },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('创建仓点明细失败:', error)
    
    // 提供更详细的错误信息
    let errorMessage = '创建仓点明细失败'
    if (error.code === 'P2002') {
      errorMessage = '仓点明细已存在'
    } else if (error.code === 'P2003') {
      errorMessage = '关联数据错误，请检查订单ID是否正确'
    } else if (error.message) {
      errorMessage = error.message
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

