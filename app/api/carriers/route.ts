/**
 * 承运商管理 API 路由 - 使用通用框架
 */

import { NextRequest, NextResponse } from 'next/server'
import { createListHandler } from '@/lib/crud/api-handler'
import { carrierConfig } from '@/lib/crud/configs/carriers'
import prisma from '@/lib/prisma'
import { checkPermission, handleValidationError, handleError, serializeBigInt, addSystemFields } from '@/lib/api/helpers'
import { getSchema } from '@/lib/crud/schema-loader'

// 使用通用框架处理 GET
const baseListHandler = createListHandler(carrierConfig)

/**
 * GET /api/carriers
 * 获取承运商列表
 */
export async function GET(request: NextRequest) {
  return baseListHandler(request)
}

/**
 * POST /api/carriers
 * 创建承运商（需要特殊处理联系人）
 */
export async function POST(request: NextRequest) {
  try {
    const permissionResult = await checkPermission(carrierConfig.permissions.create)
    if (permissionResult.error) return permissionResult.error
    const currentUser = permissionResult.user

    const body = await request.json()
    const createSchema = getSchema(carrierConfig.schemaName, 'create')
    const validationResult = createSchema.safeParse(body)
    
    if (!validationResult.success) {
      return handleValidationError(validationResult.error)
    }

    const data = validationResult.data as any

    if (data.carrier_code) {
      const existing = await prisma.carriers.findUnique({
        where: { carrier_code: data.carrier_code },
      })
      if (existing) {
        return NextResponse.json(
          { error: '承运商代码已存在' },
          { status: 409 }
        )
      }
    }

    // 处理联系人
    let contactId: bigint | null = null
    if (data.contact) {
      const contactData: any = {
        related_entity_type: 'carrier',
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
      };
      // 自动添加系统维护字段
      await addSystemFields(contactData, currentUser, true);
      
      const contact = await prisma.contact_roles.create({
        data: contactData,
      })
      contactId = contact.contact_id
    }

    const carrierData: any = {
      carrier_code: data.carrier_code,
      name: data.name,
      carrier_type: data.carrier_type,
      contact_id: contactId,
    };
    // 自动添加系统维护字段
    await addSystemFields(carrierData, currentUser, true);
    
    const carrier = await prisma.carriers.create({
      data: carrierData,
      include: {
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
        data: { related_entity_id: carrier.carrier_id },
      })
    }

    return NextResponse.json(
      {
        data: serializeBigInt(carrier),
        message: '承运商创建成功',
      },
      { status: 201 }
    )
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '承运商代码已存在' },
        { status: 409 }
      )
    }
    return handleError(error, '创建承运商失败')
  }
}
