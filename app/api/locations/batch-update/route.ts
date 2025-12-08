/**
 * 位置批量更新 API 路由 - 自定义处理，因为需要自动计算时区、纬度、经度
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkPermission, handleError, serializeBigInt, addSystemFields } from '@/lib/api/helpers'
import { locationConfig } from '@/lib/crud/configs/locations'
import prisma from '@/lib/prisma'

/**
 * 根据地址信息自动计算时区、纬度、经度
 * 如果没有足够的地址信息，返回 "-" 或 null
 */
function calculateLocationData(data: {
  address_line1?: string | null
  address_line2?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null
}): {
  timezone: string | null
  latitude: number | null
  longitude: number | null
} {
  // 构建地址字符串用于地理编码
  const addressParts: string[] = []
  if (data.address_line1) addressParts.push(data.address_line1)
  if (data.address_line2) addressParts.push(data.address_line2)
  if (data.city) addressParts.push(data.city)
  if (data.state) addressParts.push(data.state)
  if (data.postal_code) addressParts.push(data.postal_code)
  if (data.country) addressParts.push(data.country)

  const fullAddress = addressParts.join(', ').trim()

  // 如果没有足够的地址信息，返回默认值
  if (!fullAddress || addressParts.length < 2) {
    return {
      timezone: '-',
      latitude: null,
      longitude: null,
    }
  }

  // 注意：这里只是占位符逻辑
  // 实际应用中，应该调用地理编码 API（如 Google Maps Geocoding API、OpenCage Geocoding API 等）
  // 来根据地址获取经纬度和时区信息
  // 由于我们没有配置地理编码 API，这里暂时返回 "-" 和 null
  // 未来可以集成地理编码服务来实现自动计算

  return {
    timezone: '-', // 暂时返回 "-"，未来可以通过地址查询时区
    latitude: null, // 暂时返回 null，未来可以通过地理编码 API 获取
    longitude: null, // 暂时返回 null，未来可以通过地理编码 API 获取
  }
}

/**
 * POST /api/locations/batch-update
 * 批量更新位置（自定义处理，因为需要自动计算时区、纬度、经度）
 */
export async function POST(request: NextRequest) {
  try {
    // 检查权限
    const permissionResult = await checkPermission(locationConfig.permissions.update)
    if (permissionResult.error) return permissionResult.error
    const currentUser = permissionResult.user

    const body = await request.json()
    const { ids, updates } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: '请提供要更新的记录ID列表' },
        { status: 400 }
      )
    }

    if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: '请提供要更新的字段' },
        { status: 400 }
      )
    }

    const idField = locationConfig.idField || 'location_id'

    // 转换为 BigInt
    const bigIntIds = ids.map((id: string | number) => {
      try {
        return BigInt(id)
      } catch {
        throw new Error(`无效的ID: ${id}`)
      }
    })

    // 检查地址相关字段是否有更新
    const addressFields = ['address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country']
    const addressFieldsUpdated = addressFields.some(field => updates[field] !== undefined)

    // 构建更新数据
    const processedUpdates: any = {}
    Object.entries(updates).forEach(([key, value]) => {
      // 排除自动计算字段，这些字段不应该在批量编辑中修改
      if (key === 'timezone' || key === 'latitude' || key === 'longitude') {
        return
      }
      processedUpdates[key] = value
    })

    // 如果地址相关字段有更新，需要为每个位置重新计算时区、纬度、经度
    if (addressFieldsUpdated) {
      // 获取所有要更新的位置数据
      const locations = await prisma.locations.findMany({
        where: {
          [idField]: { in: bigIntIds },
        },
      })

      // 使用事务确保数据一致性
      await prisma.$transaction(async (tx) => {
        for (const location of locations) {
          // 合并更新数据和现有数据
          const mergedData = {
            address_line1: processedUpdates.address_line1 ?? location.address_line1,
            address_line2: processedUpdates.address_line2 ?? location.address_line2,
            city: processedUpdates.city ?? location.city,
            state: processedUpdates.state ?? location.state,
            postal_code: processedUpdates.postal_code ?? location.postal_code,
            country: processedUpdates.country ?? location.country,
          }

          // 计算时区、纬度、经度
          const locationData = calculateLocationData(mergedData)

          // 构建单个位置的更新数据
          const singleUpdate: any = { ...processedUpdates }
          singleUpdate.timezone = locationData.timezone
          singleUpdate.latitude = locationData.latitude
          singleUpdate.longitude = locationData.longitude

          // 自动添加系统维护字段（只更新修改人/时间）
          await addSystemFields(singleUpdate, currentUser, false)

          // 更新单个位置（使用 location_id 作为唯一标识）
          await tx.locations.update({
            where: { location_id: location.location_id },
            data: singleUpdate,
          })
        }
      })
    } else {
      // 如果没有地址字段更新，直接批量更新
      // 自动添加系统维护字段（只更新修改人/时间）
      await addSystemFields(processedUpdates, currentUser, false)

      await prisma.locations.updateMany({
        where: {
          [idField]: { in: bigIntIds },
        },
        data: processedUpdates,
      })
    }

    return NextResponse.json({
      message: `成功更新 ${ids.length} 条位置记录`,
    })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '位置代码已存在' },
        { status: 409 }
      )
    }
    return handleError(error, '批量更新位置失败')
  }
}

