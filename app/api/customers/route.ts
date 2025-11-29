import { NextRequest, NextResponse } from 'next/server';
import { createListHandler } from '@/lib/crud/api-handler';
import { customerConfig } from '@/lib/crud/configs/customers';
import { checkPermission, handleValidationError, handleError, serializeBigInt, addSystemFields } from '@/lib/api/helpers';
import { customerCreateSchema } from '@/lib/validations/customer';
import prisma from '@/lib/prisma';

// GET - 获取客户列表（使用统一框架）
export const GET = createListHandler(customerConfig);

/**
 * POST /api/customers
 * 创建客户（保留自定义逻辑，因为需要特殊处理联系人）
 */
export async function POST(request: NextRequest) {
  try {
    // 检查权限
    const permissionResult = await checkPermission(['admin', 'oms_manager']);
    if (permissionResult.error) return permissionResult.error;
    const currentUser = permissionResult.user;

    const body = await request.json();

    // 验证数据
    const validationResult = customerCreateSchema.safeParse(body);
    if (!validationResult.success) {
      return handleValidationError(validationResult.error);
    }

    const data = validationResult.data;

    // 检查代码是否已存在
    const existing = await prisma.customers.findUnique({
      where: { code: data.code },
    });
    if (existing) {
      return NextResponse.json(
        { error: '客户代码已存在' },
        { status: 409 }
      );
    }

    // 处理联系人信息
    // 注意：数据库要求 contact_roles.name 非空，所以只有当提供了 name 时才创建联系人
    let contactId: bigint | null = null;
    if (data.contact && data.contact.name) {
      const contactData: any = {
        related_entity_type: 'customer',
        related_entity_id: BigInt(0), // 临时值，创建客户后会更新
        role: 'primary',
        name: data.contact.name,
        phone: data.contact.phone || null,
        email: data.contact.email || null,
        address_line1: data.contact.address_line1 || null,
        address_line2: data.contact.address_line2 || null,
        city: data.contact.city || null,
        state: data.contact.state || null,
        postal_code: data.contact.postal_code || null,
        country: data.contact.country || null,
      };
      // 自动添加系统维护字段
      addSystemFields(contactData, currentUser, true);
      
      const contact = await prisma.contact_roles.create({
        data: contactData,
      });
      contactId = contact.contact_id;
    }

    // 创建客户
    const customerData: any = {
      code: data.code,
      name: data.name,
      company_name: data.company_name,
      credit_limit: data.credit_limit,
      status: data.status,
      contact_id: contactId,
    };
    // 自动添加系统维护字段
    addSystemFields(customerData, currentUser, true);
    
    const customer = await prisma.customers.create({
      data: customerData,
      include: {
        contact_roles: true,
      },
    });

    // 更新联系人的 related_entity_id
    if (contactId) {
      await prisma.contact_roles.update({
        where: { contact_id: contactId },
        data: { related_entity_id: customer.id },
      });
    }

    return NextResponse.json(
      {
        data: serializeBigInt(customer),
        message: '客户创建成功',
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '客户代码已存在' },
        { status: 409 }
      );
    }
    return handleError(error, '创建客户失败');
  }
}
