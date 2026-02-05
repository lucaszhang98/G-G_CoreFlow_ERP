/**
 * 位置管理详情/更新/删除 API 路由 - 使用通用框架
 */

import { NextRequest, NextResponse } from 'next/server'
import { createDetailHandler, createDeleteHandler } from '@/lib/crud/api-handler'
import { locationConfig } from '@/lib/crud/configs/locations'
import { checkAuth, checkPermission, handleValidationError, handleError, serializeBigInt, addSystemFields } from '@/lib/api/helpers'
import { locationUpdateSchema } from '@/lib/validations/location'
import prisma from '@/lib/prisma'

// 使用通用框架处理 GET, DELETE
const baseDetailHandler = createDetailHandler(locationConfig)
const baseDeleteHandler = createDeleteHandler(locationConfig)

/**
 * GET /api/locations/:id
 * 获取位置详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return baseDetailHandler(request, { params })
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
 * PUT /api/locations/:id
 * 更新位置（自定义处理，因为需要自动计算时区、纬度、经度）
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 检查权限
    const permissionResult = await checkPermission(['admin', 'oms_manager', 'tms_manager'])
    if (permissionResult.error) return permissionResult.error
    const currentUser = permissionResult.user

    // 处理 params（Next.js 15 中 params 可能是 Promise）
    const resolvedParams = await params

    // 检查位置是否存在
    const existing = await prisma.locations.findUnique({
      where: { location_id: BigInt(resolvedParams.id) },
    })

    if (!existing) {
      return NextResponse.json(
        { error: '位置不存在' },
        { status: 404 }
      )
    }

    const body = await request.json()

    // 验证数据
    const validationResult = locationUpdateSchema.safeParse(body)
    if (!validationResult.success) {
      return handleValidationError(validationResult.error)
    }

    const data = validationResult.data

    // 如果修改了位置代码，检查是否冲突
    if (data.location_code && data.location_code !== existing.location_code) {
      const codeExists = await prisma.locations.findUnique({
        where: { location_code: data.location_code },
      })
      if (codeExists) {
        return NextResponse.json(
          { error: '位置代码已存在' },
          { status: 409 }
        )
      }
    }

    // 构建更新数据
    const updateData: any = {}

    if (data.location_code !== undefined) updateData.location_code = data.location_code
    if (data.name !== undefined) updateData.name = data.name
    if (data.location_type !== undefined) updateData.location_type = data.location_type
    if (data.address_line1 !== undefined) updateData.address_line1 = data.address_line1 || null
    if (data.address_line2 !== undefined) updateData.address_line2 = data.address_line2 || null
    if (data.city !== undefined) updateData.city = data.city || null
    if (data.state !== undefined) updateData.state = data.state || null
    if (data.postal_code !== undefined) updateData.postal_code = data.postal_code || null
    if (data.country !== undefined) updateData.country = data.country || null
    if (data.notes !== undefined) updateData.notes = data.notes || null

    // 如果地址相关字段有更新，重新计算时区、纬度、经度
    const addressFieldsUpdated = 
      data.address_line1 !== undefined ||
      data.address_line2 !== undefined ||
      data.city !== undefined ||
      data.state !== undefined ||
      data.postal_code !== undefined ||
      data.country !== undefined

    if (addressFieldsUpdated) {
      const locationData = calculateLocationData({
        address_line1: updateData.address_line1 ?? existing.address_line1,
        address_line2: updateData.address_line2 ?? existing.address_line2,
        city: updateData.city ?? existing.city,
        state: updateData.state ?? existing.state,
        postal_code: updateData.postal_code ?? existing.postal_code,
        country: updateData.country ?? existing.country,
      })
      updateData.timezone = locationData.timezone
      updateData.latitude = locationData.latitude
      updateData.longitude = locationData.longitude
    }

    // 自动添加系统维护字段（只更新修改人/时间）
    await addSystemFields(updateData, currentUser, false)

    const location = await prisma.locations.update({
      where: { location_id: BigInt(resolvedParams.id) },
      data: updateData,
    })

    return NextResponse.json({
      data: serializeBigInt(location),
      message: '位置更新成功',
    })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '位置代码已存在' },
        { status: 409 }
      )
    }
    return handleError(error, '更新位置失败')
  }
}

/**
 * DELETE /api/locations/:id
 * 删除位置
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return baseDeleteHandler(request, { params })
}
