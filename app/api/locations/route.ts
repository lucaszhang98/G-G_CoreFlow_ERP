/**
 * 位置管理 API 路由 - 使用通用框架
 */

import { NextRequest, NextResponse } from 'next/server'
import { createListHandler, createCreateHandler } from '@/lib/crud/api-handler'
import { locationConfig } from '@/lib/crud/configs/locations'
import { checkAuth, checkPermission, handleValidationError, handleError, serializeBigInt, addSystemFields } from '@/lib/api/helpers'
import { locationCreateSchema } from '@/lib/validations/location'
import prisma from '@/lib/prisma'

// 使用通用框架处理 GET
const baseListHandler = createListHandler(locationConfig)

/**
 * GET /api/locations
 * 获取位置列表
 */
export async function GET(request: NextRequest) {
  return baseListHandler(request)
}

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
 * POST /api/locations
 * 创建位置（自定义处理，因为需要自动计算时区、纬度、经度）
 */
export async function POST(request: NextRequest) {
  try {
    // 检查权限
    const permissionResult = await checkPermission(['admin', 'oms_manager', 'tms_manager'])
    if (permissionResult.error) return permissionResult.error
    const currentUser = permissionResult.user

    const body = await request.json()

    // 验证数据
    const validationResult = locationCreateSchema.safeParse(body)
    if (!validationResult.success) {
      return handleValidationError(validationResult.error)
    }

    const data = validationResult.data

    // 检查位置代码是否已存在
    if (data.location_code) {
      const existing = await prisma.locations.findUnique({
        where: { location_code: data.location_code },
      })
      if (existing) {
        return NextResponse.json(
          { error: '位置代码已存在' },
          { status: 409 }
        )
      }
    }

    // 自动计算时区、纬度、经度
    const locationData = calculateLocationData({
      address_line1: data.address_line1,
      address_line2: data.address_line2,
      city: data.city,
      state: data.state,
      postal_code: data.postal_code,
      country: data.country,
    })

    // 创建位置数据
    const locationCreateData: any = {
      location_code: data.location_code,
      name: data.name,
      location_type: data.location_type,
      address_line1: data.address_line1 || null,
      address_line2: data.address_line2 || null,
      city: data.city || null,
      state: data.state || null,
      postal_code: data.postal_code || null,
      country: data.country || null,
      timezone: locationData.timezone,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      notes: data.notes || null,
    }

    // 自动添加系统维护字段
    await addSystemFields(locationCreateData, currentUser, true)

    const location = await prisma.locations.create({
      data: locationCreateData,
    })

    return NextResponse.json(
      {
        data: serializeBigInt(location),
        message: '位置创建成功',
      },
      { status: 201 }
    )
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '位置代码已存在' },
        { status: 409 }
      )
    }
    return handleError(error, '创建位置失败')
  }
}
