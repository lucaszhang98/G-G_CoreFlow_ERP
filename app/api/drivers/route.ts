/**
 * 司机管理 API 路由 - 使用通用框架
 */

import { NextRequest, NextResponse } from 'next/server'
import { createListHandler } from '@/lib/crud/api-handler'
import { driverConfig } from '@/lib/crud/configs/drivers'
import prisma from '@/lib/prisma'
import { checkPermission, handleValidationError, handleError, serializeBigInt } from '@/lib/api/helpers'
import { getSchema } from '@/lib/crud/schema-loader'

// 使用通用框架处理 GET
const baseListHandler = createListHandler(driverConfig)

/**
 * GET /api/drivers
 * 获取司机列表
 */
export async function GET(request: NextRequest) {
  return baseListHandler(request)
}

/**
 * POST /api/drivers
 * 创建司机（需要特殊处理联系人）
 */
export async function POST(request: NextRequest) {
  try {
    const permissionResult = await checkPermission(driverConfig.permissions.create)
    if (permissionResult.error) return permissionResult.error

    const body = await request.json()
    const createSchema = getSchema(driverConfig.schemaName, 'create')
    const validationResult = createSchema.safeParse(body)
    
    if (!validationResult.success) {
      return handleValidationError(validationResult.error)
    }

    const data = validationResult.data as any

    if (data.driver_code) {
      const existing = await prisma.drivers.findUnique({
        where: { driver_code: data.driver_code },
      })
      if (existing) {
        return NextResponse.json(
          { error: '司机代码已存在' },
          { status: 409 }
        )
      }
    }

    // 处理联系人
    let contactId: bigint | null = null
    if (data.contact) {
      const contact = await prisma.contact_roles.create({
        data: {
          related_entity_type: 'driver',
          related_entity_id: BigInt(0),
          role: 'primary',
          name: data.contact.name,
          phone: data.contact.phone,
          email: data.contact.email,
          address_line1: data.contact.address_line1,
          address_line2: data.contact.address_line2,
          city: data.contact.city,
          state: data.contact.state,
          postal_code: data.contact.postal_code,
          country: data.contact.country,
        },
      })
      contactId = contact.contact_id
    }

    const driver = await prisma.drivers.create({
      data: {
        driver_code: data.driver_code,
        license_number: data.license_number,
        license_expiration: data.license_expiration ? new Date(data.license_expiration) : null,
        status: data.status,
        carrier_id: data.carrier_id ? BigInt(data.carrier_id) : null,
        contact_id: contactId,
        notes: data.notes,
      },
      include: {
        carriers: {
          select: {
            carrier_id: true,
            name: true,
          },
        },
        contact_roles: {
          select: {
            contact_id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
      },
    })

    if (contactId) {
      await prisma.contact_roles.update({
        where: { contact_id: contactId },
        data: { related_entity_id: driver.driver_id },
      })
    }

    return NextResponse.json(
      {
        data: serializeBigInt(driver),
        message: '司机创建成功',
      },
      { status: 201 }
    )
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '司机代码已存在' },
        { status: 409 }
      )
    }
    return handleError(error, '创建司机失败')
  }
}
